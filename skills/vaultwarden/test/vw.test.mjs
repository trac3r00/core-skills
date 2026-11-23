import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/vw.mjs", import.meta.url));
const PASSWORD = "fixture-mäster pass";
const CLIENT_ID = "user.fixture-id";
const CLIENT_SECRET = "fixture-client-secret";
const HOST = "vault.example.test";
const ITEMS = [
  { id: "11111111-1111-4111-8111-111111111111", type: 1, name: "GitHub", login: { username: "me@example.com", password: "gh-secret-1", totp: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP", uris: [{ uri: "https://github.com/login" }] } },
  { id: "22222222-2222-4222-8222-222222222222", type: 1, name: "GitHub work", login: { username: "work@example.com", password: "gh-secret-2", uris: [{ uri: "https://github.com" }] } },
  { id: "33333333-3333-4333-8333-333333333333", type: 1, name: "Router", login: { username: "admin", password: "router-secret", uris: [{ uri: "192.168.0.1" }] } },
  { id: "44444444-4444-4444-8444-444444444444", type: 2, name: "GitHub note", notes: "not a login" },
];

// Stand-in for bw with the real CLI's contract: argv, env, JSON shapes, and "each unlock cancels earlier session keys".
const FAKE_BW = [
  "#!/usr/bin/env node",
  "const fs = require('fs');",
  "const dir = process.env.FAKE_DIR; const a = process.argv.slice(2); const f = (n) => dir + '/' + n;",
  "fs.appendFileSync(f('calls.log'), JSON.stringify(a) + '\\n');",
  "const items = JSON.parse(fs.readFileSync(f('items.json'), 'utf8'));",
  "const state = fs.readFileSync(f('state'), 'utf8').trim();",
  "const current = fs.existsSync(f('current')) ? fs.readFileSync(f('current'), 'utf8') : '';",
  "const unlocked = state !== 'unauthenticated' && current !== '' && process.env.BW_SESSION === current;",
  "const out = (s) => { process.stdout.write(s); process.exit(0); };",
  "const die = (s) => { process.stderr.write(s); process.exit(1); };",
  "const host = (u) => { try { return new URL(/:\\/\\//.test(u) ? u : 'https://' + u).hostname; } catch { return ''; } };",
  "if (a[0] === 'status') out(JSON.stringify({ serverUrl: 'https://" + HOST + "', lastSync: null, userEmail: state === 'unauthenticated' ? null : 'me@example.com', status: state === 'unauthenticated' ? state : unlocked ? 'unlocked' : 'locked' }));",
  "if (a[0] === 'login' && a[1] === '--apikey') { if (process.env.BW_CLIENTID === " + JSON.stringify(CLIENT_ID) + " && process.env.BW_CLIENTSECRET === " + JSON.stringify(CLIENT_SECRET) + ") { fs.writeFileSync(f('state'), 'loggedin'); out('You are logged in!'); } die('client_id or client_secret is incorrect. Try again.'); }",
  "if (a[0] === 'logout') { fs.writeFileSync(f('state'), 'unauthenticated'); fs.writeFileSync(f('current'), ''); out('You have logged out.'); }",
  "if (a[0] === 'unlock') { if (state === 'unauthenticated') die('You are not logged in.'); const v = a.indexOf('--passwordenv'); if (v >= 0 && process.env[a[v + 1]] === " + JSON.stringify(PASSWORD) + ") { const n = (fs.existsSync(f('counter')) ? Number(fs.readFileSync(f('counter'), 'utf8')) : 0) + 1; fs.writeFileSync(f('counter'), String(n)); fs.writeFileSync(f('current'), 'session-' + n); out('session-' + n); } die('Invalid master password.'); }",
  "if (a[0] === 'lock') { fs.writeFileSync(f('current'), ''); out('Your vault is locked.'); }",
  "if (state === 'unauthenticated') die('You are not logged in.');",
  "if (!unlocked) die('Vault is locked.');",
  "if (a[0] === 'sync') out('Syncing complete.');",
  "if (a[0] === 'list') { let r = items; const s = a.indexOf('--search'); if (s >= 0) r = r.filter((i) => i.name.toLowerCase().includes(a[s + 1].toLowerCase())); const u = a.indexOf('--url'); if (u >= 0) r = r.filter((i) => (i.login?.uris ?? []).some((x) => host(x.uri) === host(a[u + 1]))); out(JSON.stringify(r)); }",
  "if (a[0] === 'get' && a[1] === 'item') { const i = items.find((x) => x.id === a[2]); i ? out(JSON.stringify(i)) : die('Not found.'); }",
  "if (a[0] === 'get' && a[1] === 'totp') out('123456');",
  "die('unexpected ' + a.join(' '));",
].join("\n");

// Stand-in for macOS security: find/delete by -s/-a, and "-i" reading add-generic-password lines on stdin.
const FAKE_SECURITY = [
  "#!/usr/bin/env node",
  "const fs = require('fs');",
  "const file = process.env.FAKE_DIR + '/keychain.json'; const a = process.argv.slice(2);",
  "fs.appendFileSync(process.env.FAKE_DIR + '/security.log', JSON.stringify(a) + '\\n');",
  "const kc = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};",
  "const opt = (args, k) => args[args.indexOf(k) + 1];",
  "if (a[0] === '-i') { const input = fs.readFileSync(0, 'utf8'); for (const line of input.split('\\n').filter(Boolean)) { const p = line.split(' '); kc[opt(p, '-s') + '|' + opt(p, '-a')] = opt(p, '-w'); } fs.writeFileSync(file, JSON.stringify(kc)); process.exit(0); }",
  "const key = opt(a, '-s') + '|' + opt(a, '-a');",
  "if (!(key in kc)) { process.stderr.write('The specified item could not be found in the keychain.'); process.exit(44); }",
  "if (a[0] === 'delete-generic-password') { delete kc[key]; fs.writeFileSync(file, JSON.stringify(kc)); process.exit(0); }",
  "if (a.includes('-w')) process.stdout.write(kc[key] + '\\n');",
  "process.exit(0);",
].join("\n");

const stored = (value) => "vw1:" + Buffer.from(value, "utf8").toString("base64");

function fixture(t, { state = "loggedin", keychain = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "vw-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "bw"), FAKE_BW, { mode: 0o755 });
  writeFileSync(join(dir, "security"), FAKE_SECURITY, { mode: 0o755 });
  writeFileSync(join(dir, "items.json"), JSON.stringify(ITEMS));
  writeFileSync(join(dir, "state"), state);
  if (keychain) writeFileSync(join(dir, "keychain.json"), JSON.stringify({
    ["omo-vaultwarden|" + HOST + "/client_id"]: stored(CLIENT_ID),
    ["omo-vaultwarden|" + HOST + "/client_secret"]: stored(CLIENT_SECRET),
    ["omo-vaultwarden|" + HOST + "/master_password"]: stored(PASSWORD),
  }));
  const env = { PATH: process.env.PATH, HOME: dir, FAKE_DIR: dir, VW_BW_BIN: join(dir, "bw"), VW_SECURITY_BIN: join(dir, "security"), VW_SESSION_FILE: join(dir, "state-dir", "session") };
  const run = (args, extra = {}) => new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env: { ...env, ...extra } }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }));
  });
  const json = async (args, extra) => { const r = await run(args, extra); return { ...r, body: JSON.parse(r.stdout) }; };
  const calls = () => readFileSync(join(dir, "calls.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const expireServerSide = () => { writeFileSync(join(dir, "state"), "unauthenticated"); writeFileSync(join(dir, "current"), ""); };
  return { dir, env, run, json, calls, expireServerSide, sessionPath: env.VW_SESSION_FILE };
}

const secretsIn = (text) => [PASSWORD, CLIENT_SECRET, "gh-secret-1", "gh-secret-2", "router-secret", "JBSWY3DPEHPK3PXP"].filter((s) => text.includes(s));

test("a missing bw reports how to install it instead of crashing", async (t) => {
  const f = fixture(t);
  const r = await f.json(["status"], { VW_BW_BIN: join(f.dir, "absent") });
  assert.equal(r.body.status, "bw_missing");
  assert.equal(r.code, 1);
});

test("status reports self-repair readiness without reading any secret", async (t) => {
  const f = fixture(t);
  const r = await f.json(["status"]);
  assert.deepEqual([r.body.status, r.body.selfHeal, r.body.missing], ["locked", true, []]);
  const log = readFileSync(join(f.dir, "security.log"), "utf8");
  assert.ok(!log.includes('"-w"'));
  const bare = fixture(t, { keychain: false });
  const b = await bare.json(["status"]);
  assert.deepEqual([b.body.selfHeal, b.body.missing], [false, ["client_id", "client_secret", "master_password"]]);
});

test("ensure logs a logged-out CLI in with the stored API key and unlocks, secrets never in argv or output", async (t) => {
  const f = fixture(t, { state: "unauthenticated" });
  const r = await f.json(["ensure"]);
  assert.deepEqual([r.body.status, r.body.recovered], ["unlocked", "login+unlock"]);
  assert.deepEqual(secretsIn(r.stdout + JSON.stringify(f.calls())), []);
  assert.equal(statSync(f.sessionPath).mode & 0o777, 0o600);
  assert.equal(readFileSync(f.sessionPath, "utf8").trim(), "session-1");
  assert.equal((await f.json(["status"])).body.status, "unlocked");
});

test("ensure on an unlocked vault changes nothing", async (t) => {
  const f = fixture(t);
  await f.json(["ensure"]);
  const before = f.calls().length;
  assert.equal((await f.json(["ensure"])).body.recovered, "none");
  assert.deepEqual(f.calls().slice(before).map((c) => c[0]), ["status"]);
});

test("a vault command repairs a session the server ended and still answers", async (t) => {
  const f = fixture(t);
  await f.json(["ensure"]);
  f.expireServerSide();
  const r = await f.run(["get", "Router", "--field", "username"]);
  assert.equal(r.stdout, "admin\n");
  assert.ok(f.calls().some((c) => c[0] === "login" && c[1] === "--apikey"));
});

test("parallel callers on a locked vault share one unlock, and all succeed", async (t) => {
  const f = fixture(t);
  const results = await Promise.all([1, 2, 3, 4, 5, 6].map(() => f.run(["get", "Router", "--field", "username"])));
  assert.deepEqual(results.map((r) => r.stdout), Array(6).fill("admin\n"));
  assert.equal(f.calls().filter((c) => c[0] === "unlock").length, 1);
});

test("a lock left by a dead process does not block", async (t) => {
  const f = fixture(t);
  mkdirSync(join(f.dir, "state-dir"), { recursive: true });
  writeFileSync(f.sessionPath + ".lock", "999999");
  assert.equal((await f.json(["ensure"])).body.status, "unlocked");
  assert.equal(existsSync(f.sessionPath + ".lock"), false);
});

test("without stored secrets, ensure hands setup to the user and never prompts", async (t) => {
  const f = fixture(t, { keychain: false });
  const r = await f.json(["ensure"]);
  assert.equal(r.body.status, "needs_user");
  assert.equal(r.code, 3);
  assert.match(r.body.command, /vw\.mjs" setup$/);
  const out = fixture(t, { state: "unauthenticated", keychain: false });
  assert.equal((await out.json(["ensure"])).body.status, "needs_user");
});

test("environment credentials work without the Keychain", async (t) => {
  const f = fixture(t, { state: "unauthenticated", keychain: false });
  const r = await f.json(["ensure"], { BW_CLIENTID: CLIENT_ID, BW_CLIENTSECRET: CLIENT_SECRET, BW_PASSWORD: PASSWORD });
  assert.equal(r.body.recovered, "login+unlock");
});

test("a wrong stored password fails cleanly and leaves no session", async (t) => {
  const f = fixture(t, { keychain: false });
  const r = await f.json(["ensure"], { BW_PASSWORD: "wrong" });
  assert.equal(r.body.status, "unlock_failed");
  assert.equal(existsSync(f.sessionPath), false);
});

test("a Keychain item not written by setup is reported, not used", async (t) => {
  const f = fixture(t);
  const kc = JSON.parse(readFileSync(join(f.dir, "keychain.json"), "utf8"));
  kc["omo-vaultwarden|" + HOST + "/master_password"] = "70c3a4";
  writeFileSync(join(f.dir, "keychain.json"), JSON.stringify(kc));
  assert.equal((await f.json(["ensure"])).body.status, "keychain_error");
});

test("a session file others can read is ignored", async (t) => {
  const f = fixture(t, { keychain: false });
  await f.json(["ensure"], { BW_PASSWORD: PASSWORD });
  chmodSync(f.sessionPath, 0o644);
  assert.equal((await f.json(["status"])).body.status, "locked");
});

test("search lists logins only, without any secret", async (t) => {
  const f = fixture(t);
  const r = await f.json(["search", "github"]);
  assert.deepEqual(r.body.items.map((i) => i.name), ["GitHub", "GitHub work"]);
  assert.deepEqual(secretsIn(r.stdout), []);
});

test("get prefers an exact name, reports ambiguity, and hides secrets by default", async (t) => {
  const f = fixture(t);
  const exact = await f.json(["get", "GitHub"]);
  assert.deepEqual([exact.body.username, exact.body.password, exact.body.totp], ["me@example.com", "<hidden>", "<hidden>"]);
  assert.deepEqual(secretsIn(exact.stdout), []);
  const vague = await f.json(["get", "git"]);
  assert.equal(vague.body.status, "ambiguous");
  assert.equal(vague.body.candidates.length, 2);
});

test("secret fields print only with --reveal", async (t) => {
  const f = fixture(t);
  assert.equal((await f.json(["get", "GitHub", "--field", "password"])).body.status, "hidden");
  assert.equal((await f.run(["get", "GitHub", "--field", "password", "--reveal"])).stdout, "gh-secret-1\n");
  assert.equal((await f.run(["get", "GitHub", "--field", "totp", "--reveal"])).stdout, "123456\n");
  assert.equal((await f.json(["get", "Router", "--field", "totp", "--reveal"])).body.status, "no_field");
});

test("a login is refused for a site its saved URIs do not cover", async (t) => {
  const f = fixture(t);
  const r = await f.json(["get", "11111111-1111-4111-8111-111111111111", "--url", "https://github.com.evil.test/login"]);
  assert.equal(r.body.status, "uri_mismatch");
  assert.deepEqual(secretsIn(r.stdout), []);
  const ok = await f.run(["get", "11111111-1111-4111-8111-111111111111", "--url", "https://gist.github.com/x", "--field", "password", "--reveal"]);
  assert.equal(ok.stdout, "gh-secret-1\n");
});

test("getLogin returns the secrets in-process for direct form filling", async (t) => {
  const f = fixture(t);
  const saved = { ...process.env };
  t.after(() => { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); });
  Object.assign(process.env, f.env);
  const { getLogin } = await import("../scripts/vw.mjs");
  const login = await getLogin("Router", { url: "http://192.168.0.1/admin" });
  assert.deepEqual([login.status, login.username, login.password, login.totp], ["found", "admin", "router-secret", null]);
});

test("lock removes the session, and forget removes the stored secrets", async (t) => {
  const f = fixture(t);
  await f.json(["ensure"]);
  assert.equal((await f.json(["lock"])).body.status, "locked");
  assert.equal(existsSync(f.sessionPath), false);
  assert.equal((await f.json(["forget"])).body.status, "forgotten");
  assert.deepEqual(JSON.parse(readFileSync(join(f.dir, "keychain.json"), "utf8")), {});
  assert.equal((await f.json(["ensure"])).body.status, "needs_user");
});
