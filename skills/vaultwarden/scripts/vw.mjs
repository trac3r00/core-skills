#!/usr/bin/env node
// Vaultwarden / Bitwarden vault access for agents, over the official bw CLI.
// Secrets never go on a command line, never print unless asked (--reveal), and the session key lives in a 0600 file.
// After a one-time "setup" (API key + master password in the macOS Keychain) every call repairs a locked or
// logged-out CLI by itself, so the vault never stays expired.
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, watch, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELF = fileURLToPath(import.meta.url);
const SERVICE = "omo-vaultwarden";
const FORMAT = "vw1:"; // Keychain values are base64 behind this prefix: "security -w" prints non-ASCII values as ambiguous hex.
const SECRETS = [
  ["client_id", "BW_CLIENTID", "API key client_id"],
  ["client_secret", "BW_CLIENTSECRET", "API key client_secret"],
  ["master_password", "BW_PASSWORD", "Master password"],
];
const NEEDS_UNLOCK = /vault is locked|not logged in|unauthenticated|session key/i;
const LOCK_WAIT_MS = 60_000;

export function sessionFile() {
  if (process.env.VW_SESSION_FILE) return process.env.VW_SESSION_FILE;
  const state = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(state, "omo-vaultwarden", "session");
}

function readSession() {
  const file = sessionFile();
  if (existsSync(file) && (statSync(file).mode & 0o077) === 0) {
    const key = readFileSync(file, "utf8").trim();
    if (key) return key;
  }
  return process.env.BW_SESSION || undefined;
}

function saveSession(key) {
  const file = sessionFile();
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, key + "\n", { mode: 0o600 });
}

function run(bin, args, { env = process.env, interactive = false, input } = {}) {
  return new Promise((resolve) => {
    const stdin = interactive ? "inherit" : input === undefined ? "ignore" : "pipe";
    const child = spawn(bin, args, { env, stdio: [stdin, "pipe", interactive ? "inherit" : "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => { stderr += d; });
    child.on("error", (e) => resolve({ code: e.code === "ENOENT" ? 127 : 1, stdout: "", stderr: e.message }));
    child.on("close", (code) => resolve({ code, stdout, stderr: stderr.trim() }));
    if (input !== undefined) child.stdin.end(input);
  });
}

function bw(args, { interactive = false, extraEnv = {} } = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.BW_SESSION;
  const session = readSession();
  if (session) env.BW_SESSION = session;
  if (!interactive) env.BW_NOINTERACTION = "true";
  return run(process.env.VW_BW_BIN || "bw", args, { env, interactive });
}

const fail = (status, detail, extra = {}) => ({ ok: false, status, detail, ...extra });
const missing = () => fail("bw_missing", "Bitwarden CLI not found. Install: brew install bitwarden-cli (or npm i -g @bitwarden/cli).");
const why = (r) => r.stderr || r.stdout.trim() || "exit " + r.code;
const needsSetup = (reason) => fail("needs_user", reason + " The user runs this once in their own terminal, then the agent retries.", { command: "node " + JSON.stringify(SELF) + " setup" });

function hostOf(value) {
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : "https://" + value).hostname.toLowerCase(); } catch { return null; }
}
const serverHost = (url) => hostOf(url || "https://vault.bitwarden.com");

// ---- Keychain ----
const security = (args, input) => run(process.env.VW_SECURITY_BIN || "security", args, { input });
const account = (host, name) => host + "/" + name;

async function keychainRead(host, name) {
  const r = await security(["find-generic-password", "-s", SERVICE, "-a", account(host, name), "-w"]);
  if (r.code === 44 || r.code === 127) return { value: undefined };
  if (r.code !== 0) return { error: fail("keychain_error", why(r)) };
  const raw = r.stdout.replace(/\n$/, "");
  if (!raw.startsWith(FORMAT)) return { error: fail("keychain_error", "Keychain item " + account(host, name) + " was not written by setup; run setup again.") };
  return { value: Buffer.from(raw.slice(FORMAT.length), "base64").toString("utf8") };
}

async function credential(host, name) {
  const env = process.env[SECRETS.find(([n]) => n === name)[1]];
  return env ? { value: env } : keychainRead(host, name);
}

async function keychainStore(host, values) {
  const lines = SECRETS.map(([name]) => "add-generic-password -U -s " + SERVICE + " -a " + account(host, name) + " -l " + SERVICE + "-" + name + " -w " + FORMAT + Buffer.from(values[name], "utf8").toString("base64")).join("\n") + "\n";
  const r = await security(["-i"], lines); // stdin, not argv: other processes cannot read the values from ps
  for (const [name] of SECRETS) {
    const back = await keychainRead(host, name);
    if (back.error || back.value !== values[name]) return fail("keychain_error", "Could not store " + name + " in the Keychain: " + (back.error?.detail ?? why(r)));
  }
  return { ok: true };
}

// ---- One process at a time repairs the CLI: every bw unlock cancels all earlier session keys. ----
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true; // holder has not written its pid yet
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

function changed(dir, ms) {
  return new Promise((resolve) => {
    let watcher;
    const timer = setTimeout(() => { watcher?.close(); resolve(); }, ms); // backstop if the release happened before the watch began
    try { watcher = watch(dir, () => { clearTimeout(timer); watcher.close(); resolve(); }); } catch { /* the timer re-checks */ }
  });
}

async function withLock(fn) {
  const file = sessionFile() + ".lock";
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      const fd = openSync(file, "wx", 0o600);
      writeSync(fd, String(process.pid));
      closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let holder = NaN;
      try { holder = Number(readFileSync(file, "utf8")); } catch { continue; }
      if (!alive(holder)) { rmSync(file, { force: true }); continue; }
      if (Date.now() >= deadline) return fail("busy", "Another process held the vault lock for " + LOCK_WAIT_MS / 1000 + " s (pid " + holder + ").");
      await changed(dirname(file), Math.min(1000, deadline - Date.now()));
    }
  }
  try { return await fn(); } finally { rmSync(file, { force: true }); }
}

// ---- State ----
async function bwStatus() {
  const r = await bw(["status"]);
  if (r.code === 127) return missing();
  if (r.code !== 0) return fail("bw_error", why(r));
  const s = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return { ok: true, status: s.status, serverUrl: s.serverUrl ?? null, userEmail: s.userEmail ?? null, lastSync: s.lastSync ?? null };
}

export async function status() {
  const s = await bwStatus();
  if (!s.ok) return s;
  const host = serverHost(s.serverUrl);
  const stored = await Promise.all(SECRETS.map(async ([name, env]) => process.env[env] ? true : (await security(["find-generic-password", "-s", SERVICE, "-a", account(host, name)])).code === 0));
  const missingNames = SECRETS.filter((_, i) => !stored[i]).map(([name]) => name);
  return { ...s, selfHeal: missingNames.length === 0, missing: missingNames };
}

async function loginAndUnlock(st, host, get) {
  let recovered = "unlock";
  if (st.status === "unauthenticated") {
    const id = await get("client_id");
    const secret = await get("client_secret");
    if (id.error || secret.error) return id.error ?? secret.error;
    if (!id.value || !secret.value) return needsSetup("The CLI is logged out and no API key is stored.");
    const r = await bw(["login", "--apikey"], { extraEnv: { BW_CLIENTID: id.value, BW_CLIENTSECRET: secret.value } });
    if (r.code !== 0) return fail("login_failed", why(r));
    recovered = "login+unlock";
  }
  const pw = await get("master_password");
  if (pw.error) return pw.error;
  if (!pw.value) return needsSetup("The vault is locked and no master password is stored.");
  const r = await bw(["unlock", "--passwordenv", "VW_UNLOCK_PASSWORD", "--raw"], { extraEnv: { VW_UNLOCK_PASSWORD: pw.value } });
  const key = r.stdout.trim().split("\n").pop().trim();
  if (r.code !== 0 || !key) return fail("unlock_failed", why(r));
  saveSession(key);
  return { ok: true, status: "unlocked", recovered };
}

// Bring the vault to "unlocked" without any prompt. Safe to call before every use and from parallel processes.
export function ensure() {
  return withLock(async () => {
    const st = await bwStatus();
    if (!st.ok) return st;
    if (st.status === "unlocked") return { ok: true, status: "unlocked", recovered: "none" };
    const host = serverHost(st.serverUrl);
    return loginAndUnlock(st, host, (name) => credential(host, name));
  });
}

let pendingInput = ""; // keystrokes typed or pasted past the previous prompt's Enter

function promptHidden(label) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    stdin.setRawMode(true); // before the prompt, so nothing typed after it is echoed
    stdin.setEncoding("utf8");
    stderr.write(label + ": ");
    let value = "";
    const finish = (error) => {
      stdin.off("data", consume);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
      error ? reject(error) : resolve(value);
    };
    const consume = (chunk) => {
      const chars = [...chunk];
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === "\r" || ch === "\n") {
          pendingInput = chars.slice(ch === "\r" && chars[i + 1] === "\n" ? i + 2 : i + 1).join("");
          finish();
          return true;
        }
        if (ch === "\u0003" || ch === "\u0004") { finish(new Error("cancelled")); return true; }
        if (ch === "\u007f" || ch === "\b") value = [...value].slice(0, -1).join("");
        else if (ch >= " ") value += ch;
      }
      return false;
    };
    const queued = pendingInput;
    pendingInput = "";
    if (queued && consume(queued)) return;
    stdin.on("data", consume);
    stdin.resume();
  });
}

// User-only, in their own terminal: ask for the API key and master password, prove them by a fresh API-key login
// and unlock, then store them in the login Keychain. Nothing is stored unless both work.
export async function setup() {
  if (!process.stdin.isTTY) return fail("needs_user", "setup reads hidden input; run it in your own terminal.", { command: "node " + JSON.stringify(SELF) + " setup" });
  const st = await bwStatus();
  if (!st.ok) return st;
  const host = serverHost(st.serverUrl);
  process.stderr.write("Vault server: " + (st.serverUrl ?? "https://vault.bitwarden.com") + "\nAPI key: web vault > Account settings > Security > Keys > View API key. Input is hidden.\n");
  const values = {};
  try { for (const [name, , label] of SECRETS) values[name] = await promptHidden(label); } catch { return fail("cancelled", "Setup cancelled; nothing stored."); }
  if (SECRETS.some(([name]) => !values[name])) return fail("invalid_input", "Every value is required; nothing stored.");
  return withLock(async () => {
    if (st.status !== "unauthenticated") await bw(["logout"]); // prove the API key itself, not an older login
    rmSync(sessionFile(), { force: true });
    const proved = await loginAndUnlock({ status: "unauthenticated" }, host, async (name) => ({ value: values[name] }));
    if (!proved.ok) return { ...proved, detail: proved.detail + " Nothing stored." };
    const stored = await keychainStore(host, values);
    return stored.ok ? { ok: true, status: "unlocked", stored: SECRETS.map(([name]) => name), selfHeal: true } : stored;
  });
}

// User fallback without stored secrets: prompt for the master password once (bw prints its prompt on stderr).
export async function unlock() {
  const done = await ensure();
  if (done.ok || done.status !== "needs_user" || !process.stdin.isTTY) return done;
  return withLock(async () => {
    const st = await bwStatus();
    if (!st.ok) return st;
    if (st.status === "unauthenticated") return fail("unauthenticated", "Run bw login (or setup) first.");
    const r = await bw(["unlock", "--raw"], { interactive: true });
    const key = r.stdout.trim().split("\n").pop().trim();
    if (r.code !== 0 || !key) return fail("unlock_failed", why(r));
    saveSession(key);
    return { ok: true, status: "unlocked", recovered: "unlock" };
  });
}

export async function lock() {
  const r = await bw(["lock"]);
  rmSync(sessionFile(), { force: true });
  if (r.code === 127) return missing();
  return r.code === 0 ? { ok: true, status: "locked" } : fail("bw_error", why(r));
}

export async function forget() {
  const st = await bwStatus();
  if (!st.ok) return st;
  const host = serverHost(st.serverUrl);
  for (const [name] of SECRETS) await security(["delete-generic-password", "-s", SERVICE, "-a", account(host, name)]);
  const locked = await lock();
  return locked.ok ? { ok: true, status: "forgotten", selfHeal: false } : locked;
}

export async function configure(url) {
  const st = await bwStatus();
  if (!st.ok) return st;
  if (st.status !== "unauthenticated") return fail("logged_in", "bw changes servers only while logged out; that logout is the user's call.", { serverUrl: st.serverUrl });
  const r = await bw(["config", "server", url]);
  return r.code === 0 ? { ok: true, status: "configured", serverUrl: url } : fail("bw_error", why(r));
}

// Run a vault command; on a locked or logged-out CLI repair once through ensure() and retry.
async function vault(args) {
  let r = await bw(args);
  if (r.code === 127) return { error: missing() };
  if (r.code !== 0 && NEEDS_UNLOCK.test(r.stderr + r.stdout)) {
    const healed = await ensure();
    if (!healed.ok) return { error: healed };
    r = await bw(args);
  }
  if (r.code !== 0) return { error: fail(/not found/i.test(r.stderr) ? "not_found" : NEEDS_UNLOCK.test(r.stderr) ? "locked" : "bw_error", why(r)) };
  return { out: r.stdout.trim() };
}

export async function sync() {
  const r = await vault(["sync"]);
  return r.error ?? { ok: true, status: "synced" };
}

function hostMatches(item, url) {
  const want = hostOf(url);
  if (!want) return false;
  return (item.login?.uris ?? []).some((u) => {
    const have = hostOf(u.uri ?? "");
    return have && (have === want || want.endsWith("." + have) || have.endsWith("." + want));
  });
}

const summary = (item) => ({ id: item.id, name: item.name, username: item.login?.username ?? null, uris: (item.login?.uris ?? []).map((u) => u.uri), hasPassword: Boolean(item.login?.password), hasTotp: Boolean(item.login?.totp) });

async function listLogins(args) {
  const r = await vault(["list", "items", ...args]);
  return r.error ?? { ok: true, items: JSON.parse(r.out).filter((i) => i.type === 1 && !i.deletedDate) };
}

export async function search(query, { url } = {}) {
  const r = await listLogins([...(query ? ["--search", query] : []), ...(url ? ["--url", url] : [])]);
  return r.ok ? { ok: true, status: "found", count: r.items.length, items: r.items.map(summary) } : r;
}

// One login with its secrets, for in-process use (eval cells): fill fields with it, never print it.
export async function getLogin(ref, { url, anyUri = false } = {}) {
  let item;
  if (UUID.test(ref ?? "")) {
    const r = await vault(["get", "item", ref]);
    if (r.error) return r.error;
    item = JSON.parse(r.out);
  } else {
    const r = await listLogins([...(ref ? ["--search", ref] : []), ...(url ? ["--url", url] : [])]);
    if (!r.ok) return r;
    const exact = r.items.filter((i) => i.name.toLowerCase() === String(ref ?? "").toLowerCase());
    const pool = exact.length ? exact : r.items;
    if (pool.length === 0) return fail("not_found", "No login matches " + JSON.stringify(ref ?? url));
    if (pool.length > 1) return fail("ambiguous", "Several logins match; pass an id.", { candidates: pool.map(summary) });
    item = pool[0];
  }
  if (url && !anyUri && !hostMatches(item, url)) return fail("uri_mismatch", "The login's saved URIs do not cover " + hostOf(url) + "; refusing to hand it to another site.", { item: summary(item) });
  let totp = null;
  if (item.login?.totp) {
    const t = await vault(["get", "totp", item.id]);
    if (!t.error) totp = t.out;
  }
  return { ok: true, status: "found", ...summary(item), password: item.login?.password ?? null, totp };
}

function copyWithClear(value, seconds) {
  if (process.platform !== "darwin") return fail("copy_unsupported", "--copy uses pbcopy (macOS).");
  return new Promise((resolve) => {
    const pb = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "ignore"] });
    pb.on("close", (code) => {
      if (code !== 0) return resolve(fail("copy_failed", "pbcopy exited " + code));
      // A detached clearer holds the value on stdin (not argv) and empties the clipboard only if it still holds it.
      const clearer = spawn(process.execPath, ["-e", "let v='';process.stdin.on('data',d=>v+=d).on('end',()=>setTimeout(()=>{const{execFileSync:x}=require('child_process');if(x('pbpaste').toString()===v)x('pbcopy',{input:''})}," + seconds * 1000 + "))"], { detached: true, stdio: ["pipe", "ignore", "ignore"] });
      clearer.stdin.end(value);
      clearer.unref();
      resolve({ ok: true, status: "copied", clearsInSeconds: seconds });
    });
    pb.stdin.end(value);
  });
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reveal" || a === "--copy" || a === "--any-uri") opts[a.slice(2)] = true;
    else if (a === "--url" || a === "--field" || a === "--clear-after") opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

const USAGE = "usage: vw.mjs status | ensure | search <query> [--url <url>] | get <name|id> [--url <url>] [--any-uri] [--field username|password|totp|uri] [--reveal|--copy [--clear-after <s>]] | sync | lock | configure <server-url> | setup | unlock | forget";

async function main(argv) {
  const opts = parseArgs(argv);
  const [cmd, arg] = opts._;
  let out;
  switch (cmd) {
    case "status": out = await status(); break;
    case "ensure": out = await ensure(); break;
    case "setup": out = await setup(); break;
    case "unlock": out = await unlock(); break;
    case "sync": out = await sync(); break;
    case "lock": out = await lock(); break;
    case "forget": out = await forget(); break;
    case "configure": out = arg ? await configure(arg) : fail("invalid_input", USAGE); break;
    case "search": out = await search(arg, { url: opts.url }); break;
    case "get": {
      const login = await getLogin(arg, { url: opts.url, anyUri: opts["any-uri"] });
      if (!login.ok) { out = login; break; }
      const field = opts.field;
      const value = field === "username" ? login.username : field === "password" ? login.password : field === "totp" ? login.totp : field === "uri" ? login.uris[0] ?? null : undefined;
      if (field && value === undefined) { out = fail("invalid_input", USAGE); break; }
      if (field && value === null) { out = fail("no_field", "This login has no " + field + "."); break; }
      if (field && opts.copy) { out = await copyWithClear(value, Number(opts["clear-after"] ?? 45)); break; }
      if (field && (field === "username" || field === "uri" || opts.reveal)) { process.stdout.write(value + "\n"); return 0; }
      if (field) { out = fail("hidden", "Secret fields print only with --reveal (pipe it) or --copy."); break; }
      const { password, totp, ...visible } = login;
      out = { ...visible, password: password ? "<hidden>" : null, totp: totp ? "<hidden>" : null };
      break;
    }
    default: out = fail("invalid_input", USAGE);
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  return out.ok ? 0 : out.status === "needs_user" ? 3 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = await main(process.argv.slice(2));
