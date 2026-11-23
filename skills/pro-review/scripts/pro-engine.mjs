#!/usr/bin/env node
// OmO Pro Review - ChatGPT-Pro engine.
// Builds (plan) or runs (run) one review of a planned brief through our own ChatGPT
// transport (chatgpt-transport.mjs). No dependencies; Node.js 24+.
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import os from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { hazardReason, isOutside, PRO_MODEL, readManifestSafe, repoLinkOnPath, sha256, show, validateBrief } from "./handoff.mjs";
import { zipEntries } from "./zip.mjs";
import { profileHolder, readSession, recoverReview, runReview, SESSION_ID, TRANSPORT_ID, transportHome } from "./chatgpt-transport.mjs";

// pro-review's transport home (sessions and the signed-in browser profile); ~/.oracle is where it lived before.
const HOME_DIR = join(os.homedir(), ".pro-review");
const LEGACY_HOME_DIR = join(os.homedir(), ".oracle");

// One home rule for the engine and chatgpt-transport.mjs's own login/check/status commands.
export { transportHome };

/**
 * Moves ~/.oracle to ~/.pro-review once and leaves a symlink, but never while a live Chrome holds the
 * profile (a person may be signing in there): then the old home keeps working and the move waits.
 */
export function migrateTransportHome(home = HOME_DIR, legacy = LEGACY_HOME_DIR, held = (profile) => profileHolder(profile) !== undefined) {
  if (existsSync(home) || !existsSync(legacy) || lstatSync(legacy).isSymbolicLink()) return "none";
  if (held(join(legacy, "browser-profile"))) return "deferred";
  renameSync(legacy, home);
  symlinkSync(home, legacy);
  return "moved";
}

/** Bytes of brief + scope sent in the message itself; covers the handoff's default 120k-token pass. */
export const INLINE_LIMIT = 600000;

let TRANSPORT_HOME = transportHome();
let PROFILE_DIR = join(TRANSPORT_HOME, "browser-profile");

const SWITCHES = new Set(["prompt-only", "keep-browser", "offscreen"]);
const VALUES = new Set(["manifest", "brief", "report", "pass", "slug", "timeout", "session"]);
const REPEAT = new Set(["attach"]);
function parseArgs(list) {
  const flags = {};
  for (let index = 0; index < list.length; index += 1) {
    const token = list[index];
    if (!token.startsWith("--")) throw new Error("pro-review engine: unexpected argument " + token);
    const key = token.slice(2);
    if (SWITCHES.has(key)) { flags[key] = true; continue; }
    if (!VALUES.has(key) && !REPEAT.has(key)) throw new Error("pro-review engine: unknown option --" + key);
    const value = list[index + 1];
    if (value === undefined || value.startsWith("--") || value === "") throw new Error("pro-review engine: --" + key + " requires a value");
    if (REPEAT.has(key)) (flags[key] ??= []).push(value);
    else flags[key] = value;
    index += 1;
  }
  if (flags.pass !== undefined && !/^[1-9]\d*$/.test(flags.pass)) throw new Error("pro-review engine: --pass must be a positive integer");
  if (flags.timeout !== undefined && (!/^\d{1,6}(ms|s|m|h)$/.test(flags.timeout) || durationMs(flags.timeout) < 1000 || durationMs(flags.timeout) > MAX_TIMEOUT_MS)) {
    throw new Error("pro-review engine: --timeout must look like 20m, 90s or 1h, between 1s and 6h");
  }
  return flags;
}
export const MAX_TIMEOUT_MS = 6 * 3600000;
export function durationMs(text) {
  const [, amount, unit] = /^(\d+)(ms|s|m|h)$/.exec(text);
  return Number(amount) * { ms: 1, s: 1000, m: 60000, h: 3600000 }[unit];
}

/**
 * Load a handoff manifest for one pass and re-validate every scoped file against
 * the plan: canonical containment, the shared path policy, regular-file type,
 * and the recorded content hash. Returns the verified bytes so the upload is a
 * snapshot of exactly what was approved, never a re-read of mutable paths.
 */
export function fromManifest(manifestPath, pass = 1) {
  const fail = (reason) => { throw new Error("pro-review engine: " + reason); };
  let manifest;
  try { manifest = readManifestSafe(manifestPath); } catch (error) { fail(error.message.replace(/^pro-review engine: /, "")); }
  if (manifest.engine?.mode !== "pro") {
    fail("manifest engine mode is " + (manifest.engine?.mode ?? "unknown") + ", not pro; use the client engine for that handoff");
  }
  if (manifest.engine.model !== undefined && manifest.engine.model !== PRO_MODEL) fail("manifest model " + manifest.engine.model + " is not the pinned " + PRO_MODEL);
  if (typeof manifest.repo !== "string" || !isAbsolute(manifest.repo)) fail("manifest repo must be an absolute path");
  const index = pass - 1;
  const scopePass = manifest.scope?.passes?.[index];
  if (!Array.isArray(scopePass) || scopePass.length === 0) fail("manifest has no pass " + pass);
  const rootReal = realpathSync(manifest.repo);
  // Before reading any dependent file: no repository link may redirect the
  // manifest, the brief or the report since planning.
  for (const path of [manifestPath, manifest.paths?.briefs?.[index], manifest.paths?.reports?.[index] ?? manifest.paths?.report]) {
    if (typeof path !== "string") continue;
    const redirect = repoLinkOnPath(path, rootReal);
    if (redirect) fail("a link inside the repository now redirects the handoff (" + redirect + "); re-plan into a real directory");
  }
  const verified = scopePass.map((file) => {
    const rel = file?.path;
    if (typeof rel !== "string" || isAbsolute(rel) || rel.split(/[\\/]/).includes("..")) fail("manifest path is not a plain repository-relative path: " + rel);
    if (typeof file.sha256 !== "string") fail("manifest predates content binding; re-plan the handoff");
    const policy = hazardReason(rel);
    if (policy) fail(rel + " is excluded by the path policy (" + policy + ")");
    let real;
    try { real = realpathSync(join(manifest.repo, rel)); } catch { fail(rel + " is missing or a dangling link"); }
    const canonicalRel = relative(rootReal, real).split(sep).join("/");
    if (canonicalRel === "" || isOutside(canonicalRel)) fail(rel + " now resolves outside the trusted root");
    const canonicalPolicy = hazardReason(canonicalRel);
    if (canonicalPolicy) fail(rel + " now resolves to an excluded path (" + canonicalPolicy + ")");
    if (!statSync(real).isFile()) fail(rel + " is not a regular file");
    const bytes = readFileSync(real);
    if (sha256(bytes) !== file.sha256) fail(rel + " changed since the handoff was planned; re-plan to approve the new content");
    return { path: rel, bytes };
  });
  // The brief becomes the prompt: it must be the regular file the plan wrote,
  // beside the manifest, with the bytes the plan recorded.
  let bound;
  try { bound = validateBrief(manifestPath, index); } catch (error) { fail(error.message); }
  const report = manifest.paths.reports?.[index] ?? manifest.paths.report;
  const files = verified.map((file) => join(manifest.repo, file.path));
  return { brief: bound.brief, prompt: bound.text, report, files, verified, rootReal, question: manifest.question, index };
}

/**
 * Write the verified bytes as one zip (paths relative to the trusted root) in a private
 * directory, so Pro's Python sandbox can unzip, search and run the scope as a project.
 * Deterministic: the same files give the same archive and SHA-256. Nothing survives a failure.
 */
export function snapshot(verified, name) {
  const dir = mkdtempSync(join(os.tmpdir(), "pro-review-upload-"));
  try {
    chmodSync(dir, 0o700);
    const archive = join(dir, name);
    const bytes = zipEntries(verified.map((file) => ({ path: file.path, bytes: file.bytes })));
    writeFileSync(archive, bytes, { flag: "wx", mode: 0o600 });
    return { dir, files: [archive], sha256: sha256(bytes), bytes: bytes.length };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * What ChatGPT accepts, from OpenAI's upload help (documents, spreadsheets, presentations,
 * images, audio) plus the archives and text files its sandbox opens. Limits per file:
 * images 20 MB, spreadsheets ~50 MB, everything else 512 MB. Magic bytes must agree with
 * the extension, so a renamed file is refused instead of failing inside ChatGPT.
 */
const MB = 1024 * 1024;
export const ATTACHMENT_KINDS = [
  { kind: "image", ext: ["png", "jpg", "jpeg", "gif", "webp"], limit: 20 * MB, how: "look at it directly" },
  { kind: "spreadsheet", ext: ["csv", "tsv", "xlsx", "xls"], limit: 50 * MB, how: "load it in Python and check every sheet" },
  { kind: "presentation", ext: ["pptx"], limit: 512 * MB, how: "read every slide, including notes" },
  { kind: "document", ext: ["pdf", "docx", "txt", "md", "rtf", "html", "json", "xml", "yaml", "yml"], limit: 512 * MB, how: "read all of it, including figures" },
  { kind: "audio", ext: ["wav", "mp3", "mpeg", "ogg", "oga", "flac", "aac", "m4a", "webm", "mp4", "pcm"], limit: 512 * MB, how: "transcribe it, then work from the transcript" },
  { kind: "archive", ext: ["zip"], limit: 512 * MB, how: "unzip it in your Python sandbox" },
];
const REFUSED_EXT = new Set(["exe", "dll", "dmg", "pkg", "app", "msi", "iso", "so", "dylib", "bin", "apk", "ipa"]);
const MAGIC = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  webp: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  pdf: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  zip: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
};
MAGIC.jpeg = MAGIC.jpg;
for (const ext of ["docx", "xlsx", "pptx"]) MAGIC[ext] = MAGIC.zip;

/** Classify one file for upload, or throw why ChatGPT would not take it. */
export function classifyAttachment(name, size, head) {
  const ext = (/\.([A-Za-z0-9]+)$/.exec(name)?.[1] ?? "").toLowerCase();
  if (REFUSED_EXT.has(ext)) throw new Error("pro-review engine: " + name + ": executables and disk images are not sent to ChatGPT");
  if (size === 0) throw new Error("pro-review engine: " + name + " is empty");
  const known = ATTACHMENT_KINDS.find((entry) => entry.ext.includes(ext));
  const entry = known ?? { kind: "file", limit: 512 * MB, how: "open it in your Python sandbox" };
  if (size > entry.limit) throw new Error("pro-review engine: " + name + " is " + size + " bytes; ChatGPT takes at most " + entry.limit / MB + " MB for a " + entry.kind);
  if (MAGIC[ext] && !MAGIC[ext](head)) throw new Error("pro-review engine: " + name + " does not contain " + ext.toUpperCase() + " data (its first bytes disagree with the extension)");
  return { kind: entry.kind, how: entry.how };
}

export const MAX_UPLOADS = 10;
/** Validate --attach paths (and the scope zip) together; returns [{ path, name, bytes, sha256, kind, how }]. */
export function prepareAttachments(paths, extra = []) {
  const seen = new Set(extra.map((item) => item.name));
  const out = paths.map((given) => {
    const path = resolve(given);
    let stats;
    try { stats = lstatSync(path); } catch { throw new Error("pro-review engine: attachment not found: " + path); }
    if (stats.isSymbolicLink() || !stats.isFile()) throw new Error("pro-review engine: an attachment must be a regular file, not a link or directory: " + path);
    for (const candidate of [path, realpathSync(path)]) {
      const reason = hazardReason(candidate.split(sep).filter(Boolean).join("/"));
      if (reason) throw new Error("pro-review engine: " + path + " is excluded by the path policy (" + reason + ")");
    }
    const name = basename(path);
    if (seen.has(name)) throw new Error("pro-review engine: two uploads are named " + name + "; ChatGPT would rename one, so rename it first");
    seen.add(name);
    const bytes = readFileSync(path);
    return { path, name, size: bytes.length, sha256: sha256(bytes), ...classifyAttachment(name, bytes.length, bytes.subarray(0, 16)) };
  });
  if (out.length + extra.length > MAX_UPLOADS) throw new Error("pro-review engine: " + (out.length + extra.length) + " uploads; one message takes at most " + MAX_UPLOADS + ", so zip related files together");
  return out;
}

/** The closing statement of every prompt: exactly what Pro received, and that nothing else exists for it. */
export function deliveryNote({ zip, files, pasted, attachments = [] }) {
  const lines = ["", "## What you received (and nothing else)", ""];
  for (const item of attachments) {
    lines.push("- " + item.name + ": " + item.kind + ", " + item.size + " bytes (sha256 " + item.sha256.slice(0, 16) + "). " + item.how.charAt(0).toUpperCase() + item.how.slice(1) + ".");
  }
  if (zip) {
    lines.push("- " + zip.name + ": a zip of the " + files + " scoped file(s) listed above, with their paths relative to the trusted root (sha256 " + zip.sha256.slice(0, 16) + ").",
      "  Unzip it in your Python sandbox to see the structure, search across files and run code; report what you ran under ## Checks run.");
    lines.push(pasted
      ? "- The same files, pasted below in full: read all of them."
      : "- The files are only in the zip (too large to paste): read every file from it before concluding.");
  } else if (attachments.length === 0) {
    lines.push("- Only this message. No code, files or archive are attached.");
  }
  lines.push("", "You cannot see the author's machine, the rest of the repository, its git history, GitHub, any connected app,",
    "or any earlier conversation, and none of your plugins or connectors has this code. Do not assume code, configuration or project",
    "details that are not in this message" + (zip || attachments.length ? " or the attached files" : "") + "; when a judgment needs them, ask for them under ## Limits instead.",
    "", "If you create files (a patch, a chart, a fixed version), make each one downloadable for the user: save it to the user's",
    "ChatGPT files so it gets a download link, not only a sandbox path (sandbox paths expire), and link it in the reply. These",
    "files are downloaded together with the report. Also put every code fix inline in the report as a unified diff.");
  return lines.join("\n");
}

/** The run's shape, shown by `plan` without the prompt body. */
export function buildInvocation({ prompt, report, files = [], slug, timeout = "45m", keepBrowser = false }) {
  return {
    transport: TRANSPORT_ID,
    transportHome: TRANSPORT_HOME,
    profileDir: PROFILE_DIR,
    prompt: { chars: prompt.length, sha256: sha256(Buffer.from(prompt, "utf8")).slice(0, 12) },
    attachments: files.length,
    report: resolve(report),
    slug: slug ?? "omo pro review",
    timeout,
    window: keepBrowser ? "front, kept open" : "background (never activated, off-screen)",
    engine: { browser: true, model: PRO_MODEL, effort: "pro", gates: ["picker: exact GPT-6 Pro before send", "server: answer recorded as GPT-6 Pro", "server: prompt and every upload stored as approved (SHA-256)"] },
  };
}

/**
 * Publish a private reply to the report path with exclusive create. On ANY failure
 * (a link now on the path, an existing report, an unwritable directory) the reply
 * is copied to its own private directory first, so the caller can delete the upload.
 */
/**
 * Make `report` appear only fully written: write a private temp file in the same
 * directory, then hard-link it into place. link() is atomic and fails with EEXIST
 * rather than replacing anything; the temp file is always removed.
 */
export function publishAtomically(bytes, report) {
  const temp = join(dirname(report), ".pro-review-publish-" + randomBytes(6).toString("hex") + ".tmp");
  try {
    writeFileSync(temp, bytes, { flag: "wx", mode: 0o600 });
    linkSync(temp, report);
  } finally {
    try { unlinkSync(temp); } catch { /* never created */ }
  }
}
export function publishReply(privateReply, report, root) {
  const keep = (reason) => {
    try {
      const dir = mkdtempSync(join(os.tmpdir(), "pro-review-reply-"));
      chmodSync(dir, 0o700);
      writeFileSync(join(dir, "reply.md"), readFileSync(privateReply), { flag: "wx", mode: 0o600 });
      return { ok: false, reason, kept: join(dir, "reply.md") };
    } catch {
      // The backup itself failed: tell the caller to retain the original reply.
      return { ok: false, reason, kept: privateReply, retained: true };
    }
  };
  try {
    const redirect = root && repoLinkOnPath(report, root);
    if (redirect) return keep("a link inside the repository now redirects the report (" + redirect + ")");
    publishAtomically(readFileSync(privateReply), report);
    return { ok: true };
  } catch (error) {
    return keep("could not publish the report (" + (error?.code ?? "error") + ")");
  }
}

/**
 * Settle a finished transport run. Publish only after a successful exit; on a
 * failed or killed exit, preserve any reply already written instead of letting
 * the upload cleanup delete it. `retain` asks the caller to keep the upload dir.
 */
export function finishRun({ status, privateReply, report, root }) {
  // An empty file is what a harvest of a still-thinking tab writes: no answer yet, never a report.
  const hasReply = Boolean(privateReply && existsSync(privateReply) && readFileSync(privateReply, "utf8").trim().length > 0);
  if (status === 0) {
    if (!hasReply) return { code: 0 };
    const published = publishReply(privateReply, report, root);
    if (published.ok) return { code: 0 };
    return { code: 2, kept: published.kept, retain: Boolean(published.retained), message: published.reason + "; reply kept at " + published.kept };
  }
  const code = typeof status === "number" && status !== 0 ? status : 1;
  if (!hasReply) return { code };
  try {
    const dir = mkdtempSync(join(os.tmpdir(), "pro-review-reply-"));
    chmodSync(dir, 0o700);
    writeFileSync(join(dir, "reply.md"), readFileSync(privateReply), { flag: "wx", mode: 0o600 });
    return { code, kept: join(dir, "reply.md"), message: "the transport exited with a failure; its reply is kept at " + join(dir, "reply.md") };
  } catch {
    return { code, kept: privateReply, retain: true, message: "the transport exited with a failure; its reply is kept at " + privateReply };
  }
}

/**
 * Publish only with both proofs: the picker read exact GPT-6 Pro right before send,
 * and ChatGPT's own record says GPT-6 Pro (or GPT-6 at Pro effort) wrote the answer.
 */
export function proEvidence(result) {
  const picker = result?.preSubmit;
  const server = result?.server;
  const serverLabel = server ? (server.modelSlug ?? "no model slug") + (server.effort ? " / effort " + server.effort : "") : "no server record";
  if (!picker?.ok) return { ok: false, reason: "the pre-submit picker did not show GPT-6 Pro (" + (picker?.label ?? "unread") + ")" };
  if (!server?.pro) return { ok: false, reason: "ChatGPT recorded the answer as " + serverLabel + ", not GPT-6 Pro" };
  if (server.promptVerified !== true) return { ok: false, reason: "ChatGPT's record of the sent message does not match the approved prompt" + (server.attachments ? " and " + server.attachments.length + " attachment(s)" : "") };
  return { ok: true, label: "picker " + picker.label + " (" + picker.status + "); server " + serverLabel + (server.promptVerified ? "; sent prompt verified" : "") };
}

/** What a person must do for each transport failure code. */
export function explainTransportFailure(error) {
  switch (error?.code) {
    case "needs_login": return "sign in once: run `node chatgpt-transport.mjs login`, sign in to ChatGPT in the plain Chrome window it opens, quit it (Cmd+Q), then rerun. Nothing was sent.";
    case "not_pro": return "GPT-6 Pro could not be selected in the picker (the account may lack Pro, or ChatGPT renamed the row). Run `node chatgpt-transport.mjs check` to see the live picker. Nothing was sent.";
    case "challenge": return "chatgpt.com showed a Cloudflare browser check: run `node chatgpt-transport.mjs login`, let the check pass in that plain window (tick it if asked), quit it (Cmd+Q). If the prompt was already sent, finish with `recover --session <id>`; otherwise rerun.";
    case "answer_failed": return "ChatGPT stopped the answer before it finished (error or partial completion). Open the conversation to see why; plan a new run rather than resubmitting the same session.";
    case "pending": return "the prompt was sent but the answer is not finished or could not be read; run `pro-engine.mjs recover --session <id> --manifest <manifest>`. Never resubmit.";
    default: return undefined;
  }
}

export function recoverTarget(flags, cwd = process.cwd(), home = TRANSPORT_HOME) {
  if (typeof flags.session !== "string" || !SESSION_ID.test(flags.session)) throw new Error("pro-review engine: recover needs --session <saved session ID> (printed as 'session <id>' when the run started)");
  if (typeof flags.manifest === "string") {
    const manifestPath = resolve(flags.manifest);
    const manifest = readManifestSafe(manifestPath);
    if (manifest.engine?.mode !== "pro") throw new Error("pro-review engine: manifest engine mode is " + (manifest.engine?.mode ?? "unknown") + ", not pro");
    if (typeof manifest.repo !== "string" || !isAbsolute(manifest.repo)) throw new Error("pro-review engine: manifest repo must be an absolute path");
    const index = Number(flags.pass ?? 1) - 1;
    const report = manifest.paths?.reports?.[index] ?? manifest.paths?.report;
    if (typeof report !== "string") throw new Error("pro-review engine: manifest has no report path for pass " + (index + 1));
    const root = realpathSync(manifest.repo);
    for (const path of [manifestPath, report]) {
      const redirect = repoLinkOnPath(path, root);
      if (redirect) throw new Error("pro-review engine: a link inside the repository redirects the handoff (" + redirect + ")");
    }
    // The saved session must be the one this brief started.
    // Fail closed: a session without its brief binding cannot be matched to this manifest.
    const bound = readSession(home, flags.session)?.tag?.briefSha256;
    if (bound !== sha256(Buffer.from(validateBrief(manifestPath, index).text, "utf8"))) {
      throw new Error("pro-review engine: session " + flags.session + " was started with a different brief than this manifest's; recover it with the manifest it belongs to");
    }
    return { report: resolve(report), root };
  }
  if (flags["prompt-only"] !== true || typeof flags.report !== "string") throw new Error("pro-review engine: recover needs --manifest FILE, or --prompt-only --report FILE");
  const root = realpathSync(cwd);
  const redirect = repoLinkOnPath(resolve(flags.report), root);
  if (redirect) throw new Error("pro-review engine: a link inside the working directory redirects the report (" + redirect + ")");
  return { report: resolve(flags.report), root };
}

/** Write the reply privately, then publish it only with Pro evidence. Returns the exit code. */
function settle(result, report, root, dir) {
  const privateReply = join(dir, "reply.md");
  writeFileSync(privateReply, result.text + (result.text.endsWith("\n") ? "" : "\n"), { flag: "wx", mode: 0o600 });
  const evidence = proEvidence(result);
  const outcome = finishRun({ status: evidence.ok ? 0 : 3, privateReply, report, root });
  if (!evidence.ok) console.error(show("pro-review engine: " + evidence.reason + "; the reply was not published as a Pro report"));
  else console.error(show("pro-review engine: Pro evidence: " + evidence.label));
  if (outcome.message) console.error(show("pro-review engine: " + outcome.message));
  if (outcome.code === 0) saveOutputs(report, result.outputs ?? []);
  else if ((result.outputs ?? []).length > 0) console.error(show("pro-review engine: " + result.outputs.length + " file(s) Pro created stay in the ChatGPT conversation; they are saved only with a published report"));
  return outcome;
}

/**
 * Save the files Pro created beside the published report, in <report>.files/, with a
 * MANIFEST.json of names, sources and SHA-256. Names are reduced to safe basenames and
 * never overwrite anything; the directory must be new.
 */
export function saveOutputs(report, outputs) {
  if (outputs.length === 0) return undefined;
  const dir = report + ".files";
  try { mkdirSync(dir, { mode: 0o700 }); } catch (error) {
    console.error(show("pro-review engine: could not create " + dir + " (" + (error?.code ?? "error") + "); Pro's files stay in the ChatGPT conversation"));
    return undefined;
  }
  const used = new Set(["MANIFEST.json"]);
  const manifest = [];
  for (const item of outputs) {
    if (!item.bytes) { manifest.push({ name: item.name, source: item.source, error: item.error }); continue; }
    const base = (basename(item.name).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "") || "output").slice(0, 120);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = base.replace(/(\.[^.]*)?$/, "-" + n + "$1");
    used.add(name.toLowerCase());
    writeFileSync(join(dir, name), item.bytes, { flag: "wx", mode: 0o600 });
    manifest.push({ name, original: item.name, source: item.source, bytes: item.bytes.length, sha256: item.sha256 });
  }
  writeFileSync(join(dir, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const saved = manifest.filter((item) => !item.error);
  console.error(show("pro-review engine: saved " + saved.length + " file(s) Pro created to " + dir + (saved.length < manifest.length ? " (" + (manifest.length - saved.length) + " not downloadable; see MANIFEST.json)" : "")));
  return dir;
}

async function recover(flags) {
  let target;
  try {
    target = recoverTarget(flags);
    let occupied = true;
    try { lstatSync(target.report); } catch { occupied = false; }
    if (occupied) throw new Error("pro-review engine: refusing to overwrite an existing report (or link) at " + target.report);
  } catch (error) {
    console.error(show(error.message));
    return 2;
  }
  const dir = mkdtempSync(join(os.tmpdir(), "pro-review-recover-"));
  chmodSync(dir, 0o700);
  let retain = false;
  try {
    const result = await recoverReview({ home: TRANSPORT_HOME, profile: PROFILE_DIR, sessionId: flags.session,
      timeoutMs: flags.timeout ? durationMs(flags.timeout) : 60000, window: "background" });
    const outcome = settle(result, target.report, target.root, dir);
    if (outcome.retain || outcome.kept === join(dir, "reply.md")) retain = true;
    return outcome.code;
  } catch (error) {
    console.error(show(error.message));
    const advice = explainTransportFailure(error);
    if (advice && error.code !== "pending") console.error(show("pro-review engine: " + advice));
    return error.code === "pending" ? 4 : error.code === "usage" || error.code === "not_submitted" ? 2 : error.code === "needs_login" || error.code === "challenge" ? 5 : 1;
  } finally {
    if (!retain) rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "run" || command === "recover") {
    if (migrateTransportHome() === "moved") console.error("pro-review: moved ~/.oracle to ~/.pro-review (a symlink stays at ~/.oracle).");
    TRANSPORT_HOME = transportHome();
    PROFILE_DIR = join(TRANSPORT_HOME, "browser-profile");
  }
  let flags;
  try {
    flags = parseArgs(rest);
  } catch (error) {
    console.error(show(error.message));
    return 2;
  }
  if (command === "recover") return recover(flags);
  if (command !== "plan" && command !== "run") {
    console.error("usage: pro-engine.mjs plan|run --manifest FILE [--pass N] [--attach FILE ...] [--keep-browser] [--slug TEXT] [--timeout 45m]\n" +
      "       pro-engine.mjs plan|run --prompt-only --brief FILE --report FILE [--attach FILE ...] [--slug TEXT] [--timeout 45m]\n" +
      "       pro-engine.mjs recover --session ID (--manifest FILE [--pass N] | --prompt-only --report FILE) [--timeout 1m]");
    return 2;
  }
  let job;
  let upload;
  try {
    if (typeof flags.manifest !== "string" && flags["prompt-only"] !== true) {
      throw new Error("pro-review engine: --brief alone would upload no files; pass --manifest <file>, or --prompt-only for a prompt-only review");
    }
    if (typeof flags.manifest === "string") {
      const pass = Number(flags.pass ?? 1);
      const loaded = fromManifest(resolve(flags.manifest), pass);
      // Every pass uploads the verified scope as one zip (Pro's sandbox can unzip, search and run
      // it) and, up to INLINE_LIMIT, also pastes it in full (ChatGPT stores a long paste as a
      // big_paste attachment that Pro reads in full). Both use the same verified manifest bytes.
      // Pasted text must decode losslessly; a non-UTF-8 file leaves that pass zip-only.
      const utf8 = new TextDecoder("utf-8", { fatal: true });
      const decodable = loaded.verified.every((file) => { try { utf8.decode(file.bytes); return true; } catch { return false; } });
      const inline = decodable && loaded.verified.reduce((size, file) => size + file.bytes.length, Buffer.byteLength(loaded.prompt)) <= INLINE_LIMIT;
      // A unique name per run: ChatGPT renames a repeated upload name to "name(1).zip".
      const zipName = (basename(loaded.rootReal).replace(/[^A-Za-z0-9._-]+/g, "-") || "scope") + "-pass" + pass + "-" + randomBytes(3).toString("hex") + ".zip";
      const attachments = prepareAttachments(flags.attach ?? [], [{ name: zipName }]);
      upload = snapshot(loaded.verified, zipName);
      const prompt = loaded.prompt + "\n" + deliveryNote({ zip: { name: zipName, sha256: upload.sha256 }, files: loaded.verified.length, pasted: inline, attachments }) +
        (inline ? "\n\nThe scoped files, pasted in full:\n\n" +
          loaded.verified.map((file) => "===== FILE: " + file.path + " =====\n" + file.bytes.toString("utf8")).join("\n\n") : "");
      job = { prompt, report: loaded.report, root: loaded.rootReal, files: [...upload.files, ...attachments.map((item) => item.path)], attachments,
        slug: typeof flags.slug === "string" ? flags.slug : "omo pro review pass " + pass,
        tag: { manifest: resolve(flags.manifest), pass, briefSha256: sha256(Buffer.from(loaded.prompt, "utf8")) } };
    } else {
      // Prompt-only keeps the same filesystem protections, with the working
      // directory as the trusted root: the brief must be a regular non-link file
      // outside the path policy, and no repository link may sit on either path.
      if (typeof flags.brief !== "string" || typeof flags.report !== "string") throw new Error("pro-review engine: --prompt-only needs --brief FILE and --report FILE");
      const root = realpathSync(process.cwd());
      const briefPath = resolve(flags.brief);
      let briefStats;
      try { briefStats = lstatSync(briefPath); } catch { throw new Error("pro-review engine: brief file not found: " + briefPath); }
      if (!briefStats.isFile() || briefStats.size > 1 << 20) throw new Error("pro-review engine: the brief must be a regular file (not a link): " + briefPath);
      for (const absolute of [briefPath, realpathSync(briefPath)]) {
        const reason = hazardReason(absolute.split(sep).filter(Boolean).join("/"));
        if (reason) throw new Error("pro-review engine: the brief is excluded by the path policy (" + reason + ")");
      }
      for (const path of [briefPath, resolve(flags.report)]) {
        const redirect = repoLinkOnPath(path, root);
        if (redirect) throw new Error("pro-review engine: a link inside the working directory redirects " + path + " (" + redirect + ")");
      }
      const brief = readFileSync(briefPath, "utf8");
      // Nothing is attached: say so, so Pro never assumes it can see the author's code or project.
      const attachments = prepareAttachments(flags.attach ?? []);
      const prompt = brief + "\n" + deliveryNote({ zip: undefined, attachments });
      job = { prompt, report: flags.report, root, files: attachments.map((item) => item.path), attachments, slug: typeof flags.slug === "string" ? flags.slug : undefined,
        tag: { briefSha256: sha256(Buffer.from(brief, "utf8")) } };
    }
    if (command === "run") {
      // lstat, not existsSync: a dangling link at the report path is an existing entry.
      let occupied = true;
      try { lstatSync(job.report); } catch { occupied = false; }
      if (occupied) throw new Error("pro-review engine: refusing to overwrite an existing report (or link) at " + job.report);
      const parent = lstatSync(dirname(resolve(job.report)));
      if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error("pro-review engine: the report directory must be a real directory: " + dirname(resolve(job.report)));
    }
  } catch (error) {
    if (upload) rmSync(upload.dir, { recursive: true, force: true });
    console.error(show(error.message));
    return 2;
  }
  // Pro with sandbox tools can take well over 20 minutes; recover covers anything longer.
  const timeout = typeof flags.timeout === "string" ? flags.timeout : "45m";
  if (command === "plan") {
    const shown = buildInvocation({ ...job, timeout, keepBrowser: flags["keep-browser"] === true });
    if (upload) shown.zip = { name: basename(upload.files[0]), bytes: upload.bytes, sha256: upload.sha256.slice(0, 16) };
    if (job.attachments?.length) shown.uploads = job.attachments.map((item) => ({ name: item.name, kind: item.kind, bytes: item.size, sha256: item.sha256.slice(0, 16) }));
    if (upload) rmSync(upload.dir, { recursive: true, force: true });
    console.log(JSON.stringify(shown, null, 2));
    return 0;
  }
  const dir = mkdtempSync(join(os.tmpdir(), "pro-review-reply-"));
  chmodSync(dir, 0o700);
  let retain = false;
  try {
    const result = await runReview({
      home: TRANSPORT_HOME, profile: PROFILE_DIR, prompt: job.prompt, files: job.files, slug: job.slug, tag: job.tag,
      timeoutMs: durationMs(timeout), keepBrowser: flags["keep-browser"] === true,
      // Never steals focus or Spaces; only --keep-browser shows a window a person acts in.
      window: flags["keep-browser"] === true ? "front" : "background",
      log: (line) => console.error(show("pro-review transport: " + line)),
    });
    const outcome = settle(result, resolve(job.report), job.root, dir);
    if (outcome.retain || outcome.kept === join(dir, "reply.md")) retain = true;
    return outcome.code;
  } catch (error) {
    console.error(show(error.message));
    const advice = explainTransportFailure(error);
    if (advice) console.error(show("pro-review engine: " + advice));
    return error.code === "pending" ? 4 : error.code === "not_pro" ? 3 : error.code === "needs_login" || error.code === "challenge" ? 5 : 1;
  } finally {
    if (!retain) rmSync(dir, { recursive: true, force: true });
    if (upload) rmSync(upload.dir, { recursive: true, force: true });
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());
