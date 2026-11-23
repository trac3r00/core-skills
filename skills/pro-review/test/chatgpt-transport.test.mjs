import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  chromeFlags, chromePath, defaultBrowser, readPicker, isProLabel, latestAnswer, newSessionId, proFailure, proSelection, readSession, serverEvidence, serverPro, sessionDir, TRANSPORT_ID,
  findConversation, isBlankTarget, outputFiles, withoutRename, Page, tilePattern, usesNativeKeychain, waitForAnswer, writeSession,
} from "../scripts/chatgpt-transport.mjs";
import { createHash } from "node:crypto";
import { sha256 } from "../scripts/handoff.mjs";
import { proEvidence, recoverTarget } from "../scripts/pro-engine.mjs";

const dir = mkdtempSync(join(os.tmpdir(), "pro-review-transport-"));
after(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;
const fresh = () => { const path = join(dir, String(n++)); mkdirSync(path); return path; };

test("only an exact GPT-6 Pro label counts as Pro", () => {
  for (const label of ["GPT-6 Pro", "6 Pro", "6Pro", "GPT6 Pro", "ChatGPT 6 Pro", "GPT-6.1 Pro"]) assert.ok(isProLabel(label), label);
  for (const label of ["Pro", "GPT-5 Pro", "6 Thinking", "6 Pro Extended", "Instant", "", undefined]) assert.ok(!isProLabel(label), String(label));
});

// Shape read from the live October 2026 picker: model radio rows plus a five-step effort slider.
const reading = (model, label, value) => ({
  button: "Thinking effort " + label,
  models: [{ text: "GPT-6", checked: model === "GPT-6" }, { text: "GPT-5.6 Sol", checked: model === "GPT-5.6 Sol" }],
  effort: { label, status: label + ", " + (value + 1) + " of 5.", value, max: 4 },
});

test("the picker passes only on the GPT-6 row checked at Pro effort", () => {
  const pro = proSelection(reading("GPT-6", "Pro", 4));
  assert.deepEqual([pro.ok, pro.label, pro.model, pro.effort, pro.effortStep.status], [true, "GPT-6 + Pro", "GPT-6", "Pro", "Pro, 5 of 5."]);
  for (const [model, label, value] of [["GPT-6", "Instant", 0], ["GPT-6", "Extra High", 3], ["GPT-5.6 Sol", "Pro", 4]]) {
    const result = proSelection(reading(model, label, value));
    assert.deepEqual([result.ok, result.label], [false, model + " + " + label]);
  }
  assert.equal(proSelection({ button: "GPT-6 Pro", models: [], effort: null }).ok, true, "legacy single-button label");
  assert.equal(proSelection({ button: "Pro", models: [], effort: null }).ok, false);
  assert.equal(proSelection(undefined).ok, false);
});

const conversation = (assistant, extra = {}, user = {}) => ({
  current_node: "a",
  mapping: {
    u: { parent: null, message: { author: { role: "user" }, content: { content_type: "text", parts: ["q"] }, ...user } },
    t: { parent: "u", message: { author: { role: "assistant" }, recipient: "python", content: { content_type: "code", text: "1+1" } } },
    a: { parent: "t", message: { id: "m1", author: { role: "assistant" }, recipient: "all", content: { content_type: "text", parts: ["# Report"] }, ...assistant } },
  },
  ...extra,
});

test("the answer and its model come from the server record; tool calls and unfinished answers are skipped", () => {
  const done = latestAnswer(conversation({ status: "finished_successfully", end_turn: true, metadata: { model_slug: "gpt-6-pro" } }));
  assert.deepEqual([done.done, done.text, done.modelSlug, done.messageId], [true, "# Report", "gpt-6-pro", "m1"]);
  assert.equal(serverPro(done), true);
  assert.equal(latestAnswer(conversation({ status: "in_progress", metadata: {} })).done, false);
  assert.equal(latestAnswer(conversation({ status: "finished_successfully", end_turn: false, metadata: {} })).done, false);
  assert.equal(latestAnswer({ mapping: {} }).done, false);
});

test("server evidence accepts only an answering GPT-6 Pro, or GPT-6 at Pro effort", () => {
  assert.equal(serverPro({ modelSlug: "gpt-6-pro" }), true);
  assert.equal(serverPro({ modelSlug: "gpt-6", effort: "pro" }), true);
  assert.equal(serverPro({ modelSlug: "gpt-6", effort: "high" }), false);
  assert.equal(serverPro({ modelSlug: "gpt-6-thinking" }), false);
  assert.equal(serverPro({ modelSlug: "gpt-5-pro" }), false);
  assert.equal(serverPro({ modelSlug: null, requestedModelSlug: "gpt-6-pro" }), false, "a request proves nothing");
  assert.equal(serverPro({ modelSlug: "gpt-6-instant", requestedModelSlug: "gpt-6-pro" }), false, "the answering model wins");
  assert.equal(serverPro({ modelSlug: "gpt-6", requestedModelSlug: "gpt-6-pro", effort: "instant" }), false);
  assert.equal(serverPro({}), false);
});

test("publication needs the pre-submit picker, the server model, and a verified prompt", () => {
  const picker = { ok: true, label: "6 Pro", status: "already-selected" };
  assert.equal(proEvidence({ preSubmit: picker, server: { modelSlug: "gpt-6-pro", pro: true, promptVerified: true } }).ok, true);
  for (const missing of [null, undefined, false]) {
    assert.equal(proEvidence({ preSubmit: picker, server: { modelSlug: "gpt-6-pro", pro: true, promptVerified: missing } }).ok, false, String(missing));
  }
  assert.match(proEvidence({ preSubmit: { ok: false, label: "Instant" }, server: { pro: true } }).reason, /picker did not show GPT-6 Pro \(Instant\)/);
  assert.match(proEvidence({ preSubmit: picker, server: { modelSlug: "gpt-6", effort: "high", pro: false } }).reason, /recorded the answer as gpt-6 \/ effort high/);
  assert.equal(proEvidence({ preSubmit: picker }).ok, false);
});

test("the launch keeps the profile's key store and the sign-in window has no DevTools port", () => {
  const mock = chromeFlags({ profile: "/p", nativeKeychain: false, platform: "darwin" });
  assert.ok(mock.includes("--use-mock-keychain") && mock.includes("--password-store=basic") && mock.includes("--remote-debugging-port=0"));
  const native = chromeFlags({ profile: "/p", nativeKeychain: true, platform: "darwin" });
  assert.ok(!native.includes("--use-mock-keychain") && !native.includes("--password-store=basic"));
  const signIn = chromeFlags({ profile: "/p", nativeKeychain: false, signIn: true, platform: "darwin" });
  assert.ok(signIn.includes("--use-mock-keychain") && signIn.includes("--user-data-dir=/p"));
  assert.ok(!signIn.some((flag) => flag.startsWith("--remote-debugging")));
  const background = chromeFlags({ profile: "/p", hidden: true, platform: "darwin" });
  assert.ok(background.includes("--headless=new"), "a background run has no window to bring forward");
  assert.ok(background.includes("--no-startup-window"), "a background run restores no earlier tabs that would keep it alive");
  assert.ok(!chromeFlags({ profile: "/p", hidden: false, platform: "darwin" }).includes("--headless=new"), "a window a person acts in is real");
});

test("the browser is the user's default when it is Chromium-based, never a forced Chrome", () => {
  const home = fresh();
  const plist = join(home, "Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist");
  mkdirSync(join(plist, ".."), { recursive: true });
  writeFileSync(plist, "");
  const brave = join(home, "Applications/Brave Browser.app");
  mkdirSync(join(brave, "Contents/Frameworks/Brave Browser Framework.framework"), { recursive: true });
  const safari = join(home, "Applications/Safari.app");
  mkdirSync(join(safari, "Contents/Frameworks"), { recursive: true });
  const fake = (handler) => (command, args) => {
    if (command === "plutil" && args[1] === "LSHandlers") return JSON.stringify([{ LSHandlerURLScheme: "http", LSHandlerRoleAll: "com.google.chrome" }, { LSHandlerURLScheme: "https", LSHandlerRoleAll: handler }]);
    if (command === "mdfind") throw new Error("Spotlight off");
    // Only the fixture's apps answer; real ones in /Applications must never match.
    if (command === "plutil" && args[1] === "CFBundleIdentifier") return !args[3].startsWith(home) ? "org.example.real\n" : args[3].includes("Brave") ? "com.brave.Browser\n" : "com.apple.Safari\n";
    if (command === "plutil" && args[1] === "CFBundleExecutable") return "Brave Browser\n";
    throw new Error("unexpected " + command);
  };
  assert.deepEqual(defaultBrowser({ platform: "darwin", run: fake("com.brave.browser"), home }), { path: join(brave, "Contents/MacOS/Brave Browser"), name: "Brave Browser" });
  assert.throws(() => defaultBrowser({ platform: "darwin", run: fake("com.apple.safari"), home }), /default browser \(Safari\) is not Chromium-based.*Nothing was sent/);
  assert.equal(chromePath({ PRO_REVIEW_BROWSER: "/x/brave" }, "darwin", () => { throw new Error("not consulted"); }), "/x/brave");
  assert.equal(chromePath({ PRO_REVIEW_CHROME: "/x/chrome" }, "darwin"), "/x/chrome", "the older variable still works");
  assert.throws(() => chromePath({ PRO_REVIEW_BROWSER: "brave" }, "darwin"), /absolute path/);
  assert.equal(chromePath({}, "darwin", () => ({ path: "/d/brave", name: "Brave" })), "/d/brave");
});

test("a picker click lost to hydration is retried, and a menu that opened is never clicked shut", async () => {
  let clicks = 0;
  const open = { button: "Thinking effort Pro", open: true, models: [], effort: { label: "Pro", status: "Pro, 5 of 5.", value: 4, max: 4 } };
  const page = {
    evaluate: async () => (clicks >= 2 ? open : { button: "Thinking effort Pro", open: false, models: [], effort: null }),
    click: async () => { clicks += 1; return true; },
    send: async () => {},
  };
  assert.equal((await readPicker(page)).effort.label, "Pro");
  assert.equal(clicks, 2, "the first click only showed a tooltip");
  clicks = 2;
  await readPicker(page);
  assert.equal(clicks, 2, "an already-open menu takes no click");
});

test("the key store follows Oracle's marker rule", () => {
  const brandNew = fresh();
  assert.equal(usesNativeKeychain(brandNew, "darwin"), true);
  const existing = fresh();
  writeFileSync(join(existing, "Local State"), "{}");
  assert.equal(usesNativeKeychain(existing, "darwin"), false);
  for (const marker of [".oracle-native-keychain-v1", ".pro-review-native-keychain-v1"]) {
    const marked = fresh();
    writeFileSync(join(marked, "Local State"), "{}");
    writeFileSync(join(marked, marker), "native-keychain\n");
    assert.equal(usesNativeKeychain(marked, "darwin"), true, marker);
  }
  assert.equal(usesNativeKeychain(brandNew, "linux"), false);
});

test("sessions round-trip and refuse path-like ids", () => {
  const home = fresh();
  const id = newSessionId("OmO Pro Review pass 1");
  assert.match(id, /^omo-pro-review-pass-1-[0-9a-f]{6}$/);
  writeSession(home, { id, transport: TRANSPORT_ID, status: "submitted", conversationId: "c-1" });
  assert.deepEqual([readSession(home, id).status, readSession(home, id).conversationId], ["submitted", "c-1"]);
  assert.equal(readSession(home, "missing-session"), undefined);
  assert.throws(() => sessionDir(home, "../escape"), /session ids/);
});

test("recover only accepts the session the manifest's brief started", () => {
  const repo = fresh();
  writeFileSync(join(repo, "a.txt"), "hello\n");
  const out = join(repo, "handoff");
  const plan = spawnSync(process.execPath, [new URL("../scripts/handoff.mjs", import.meta.url).pathname, "plan", "--repo", repo, "--target", "a.txt", "--out", out, "--question", "q"], { encoding: "utf8" });
  assert.equal(plan.status, 0, plan.stderr);
  const manifest = join(out, "manifest.json");
  assert.equal(JSON.parse(readFileSync(manifest, "utf8")).engine.transport, TRANSPORT_ID);
  const brief = readFileSync(join(out, "brief-pass1.md"), "utf8");
  const home = fresh();
  writeSession(home, { id: "good-run", transport: TRANSPORT_ID, tag: { briefSha256: sha256(Buffer.from(brief, "utf8")) } });
  writeSession(home, { id: "other-run", transport: TRANSPORT_ID, tag: { briefSha256: "0".repeat(64) } });
  assert.equal(recoverTarget({ session: "good-run", manifest }, repo, home).report, join(out, "report-pass1.md"));
  assert.throws(() => recoverTarget({ session: "other-run", manifest }, repo, home), /different brief/);
  assert.throws(() => recoverTarget({ session: "../x", manifest }, repo, home), /needs --session/);
});

const answered = (status, extra = {}) => conversation({ status, end_turn: true, metadata: { model_slug: "gpt-6-pro" } }, extra);

/** A stand-in page whose backend answers come from a script, one per poll. */
const scriptedPage = (responses) => {
  let calls = 0;
  return { calls: () => calls, evaluate: async () => { const next = responses[Math.min(calls, responses.length - 1)]; calls += 1; if (next instanceof Error) throw next; return next; } };
};

test("the wait returns the final answer and ignores transient poll failures", async () => {
  const page = scriptedPage([{ status: 0 }, { status: 200, body: answered("in_progress") }, { status: 200, body: answered("finished_successfully") }]);
  const seen = [];
  const answer = await waitForAnswer(page, "c-1", { timeoutMs: 60000, fastMs: 0, onProgress: (a) => seen.push(a.status) });
  assert.deepEqual([answer.done, answer.modelSlug, page.calls(), seen], [true, "gpt-6-pro", 3, ["in_progress", "finished_successfully"]]);
});

test("the wait ends at once on a failed answer, an expired session, or a lost browser", async () => {
  await assert.rejects(waitForAnswer(scriptedPage([{ status: 200, body: answered("finished_partial_completion") }]), "c", { timeoutMs: 60000, fastMs: 0 }),
    (error) => error.code === "answer_failed" && /finished_partial_completion/.test(error.message));
  await assert.rejects(waitForAnswer(scriptedPage([{ status: 401, body: null }]), "c", { timeoutMs: 60000, fastMs: 0 }), (error) => error.code === "pending" && /expired/.test(error.message));
  const lost = scriptedPage([new Error("pro-review transport: DevTools connection closed")]);
  await assert.rejects(waitForAnswer(lost, "c", { timeoutMs: 60000, fastMs: 0 }), (error) => error.code === "pending" && /browser went away/.test(error.message));
  assert.equal(lost.calls(), 1);
  await assert.rejects(waitForAnswer(scriptedPage([{ status: 200, body: answered("in_progress") }]), "c", { timeoutMs: 0, fastMs: 0 }), (error) => error.code === "pending" && /no final answer/.test(error.message));
  const challenged = scriptedPage([{ status: 200, body: answered("in_progress") }, { status: 403, body: null }, { status: 403, body: null }, { status: 403, body: null }]);
  await assert.rejects(waitForAnswer(challenged, "c", { timeoutMs: 60000, fastMs: 0 }), (error) => error.code === "challenge" && /recover this session/.test(error.message));
  assert.equal(challenged.calls(), 4, "three blocked polls in a row end the wait, not the deadline");
  const blip = scriptedPage([{ status: 403, body: null }, { status: 403, body: null }, { status: 200, body: answered("finished_successfully") }]);
  assert.equal((await waitForAnswer(blip, "c", { timeoutMs: 60000, fastMs: 0 })).done, true, "a short blip does not");
});

test("the sent turn must be the approved prompt, and every upload the approved bytes, by stored hash", () => {
  const sent = (text, attachments = []) => latestAnswer(conversation({ status: "finished_successfully", end_turn: true, metadata: { model_slug: "gpt-6-pro" } },
    {}, { content: { content_type: "text", parts: [text] }, metadata: { attachments } }));
  const sha = (text) => createHash("sha256").update(text).digest("hex");
  const prompt = "Review ─ this code\n";
  const paste = { id: "file_p", name: "Pasted text.txt", size: Buffer.byteLength(prompt), is_big_paste: true };
  const zip = { id: "file_z", name: "repo-pass1.zip", size: 10 };
  const approved = [{ name: "repo-pass1.zip", sha256: sha("zip bytes") }];
  const typed = serverEvidence(sent("Review  ─ this\ncode"), prompt, []);
  assert.deepEqual([typed.promptVerified, typed.sentAs], [true, "inline"], "the editor's whitespace re-flow is tolerated");
  assert.equal(serverEvidence(sent("Review ─ thiscode"), prompt, []).promptVerified, false, "a removed word boundary is not");
  assert.equal(serverEvidence(sent("ㄴReview ─ this code"), prompt, []).promptVerified, false);
  const pasted = serverEvidence(sent("", [paste]), prompt, [], undefined, { file_p: sha(prompt) });
  assert.deepEqual([pasted.promptVerified, pasted.sentAs], [true, "big-paste"]);
  assert.equal(serverEvidence(sent("", [paste]), prompt, [], undefined, { file_p: sha("Review ─ that code\n") }).promptVerified, false, "same size, other bytes");
  assert.equal(serverEvidence(sent("", [paste]), prompt, [], undefined, { file_p: null }).promptVerified, false, "unreadable paste");
  const both = serverEvidence(sent("", [paste, zip]), prompt, approved, undefined, { file_p: sha(prompt), file_z: sha("zip bytes") });
  assert.deepEqual([both.promptVerified, both.uploadsVerified], [true, true], "paste plus the approved zip");
  assert.equal(serverEvidence(sent("", [paste, zip]), prompt, approved, undefined, { file_p: sha(prompt), file_z: sha("other zip") }).promptVerified, false, "zip bytes differ");
  assert.equal(serverEvidence(sent("", [paste]), prompt, approved, undefined, { file_p: sha(prompt) }).promptVerified, false, "zip missing");
  assert.equal(serverEvidence(sent(prompt, [zip, { id: "file_x", name: "extra.txt" }]), prompt, approved, undefined, { file_z: sha("zip bytes"), file_x: sha("x") }).promptVerified, false, "unapproved extra upload");
  const meta = { uploads: approved, promptSha256: sha(prompt), normPromptSha256: sha("Review ─ this code") };
  assert.equal(serverEvidence(sent("", [paste, zip]), undefined, undefined, meta, { file_p: sha(prompt), file_z: sha("zip bytes") }).promptVerified, true, "recover uses the recorded hashes");
  assert.equal(serverEvidence(sent(prompt), undefined, undefined, { files: 0 }).promptVerified, false, "older sessions are never verified");
});

test("the answer is the reply to the run's own first turn, never a later one", () => {
  const msg = (id, role, text, extra = {}) => ({ id, author: { role }, recipient: "all", content: { content_type: "text", parts: [text] }, status: "finished_successfully", end_turn: true, metadata: { model_slug: "gpt-6-pro" }, ...extra });
  const graph = { current_node: "a2", mapping: {
    u1: { parent: null, message: msg("u1", "user", "review this") }, a1: { parent: "u1", message: msg("a1", "assistant", "# Report one") },
    u2: { parent: "a1", message: msg("u2", "user", "and now?") }, a2: { parent: "u2", message: msg("a2", "assistant", "later") } } };
  const answer = latestAnswer(graph);
  assert.deepEqual([answer.messageId, answer.text, answer.userText], ["a1", "# Report one", "review this"]);
  const waiting = latestAnswer({ current_node: "u1", mapping: { u1: graph.mapping.u1 } });
  assert.deepEqual([waiting.done, waiting.userText], [false, "review this"], "the sent turn is readable before any answer");
});

test("a send whose conversation id was lost is found by its exact first turn", async () => {
  const sha = (text) => createHash("sha256").update(text).digest("hex");
  const prompt = "Reply with PONG";
  const meta = { sentAt: "2026-10-27T05:00:00.000Z", uploads: [], promptSha256: sha(prompt), normPromptSha256: sha(prompt) };
  const turn = (text) => ({ status: 200, body: { current_node: "u", mapping: { u: { parent: null, message: { id: "u", author: { role: "user" }, content: { content_type: "text", parts: [text] } } } } } });
  const after = Date.parse(meta.sentAt) / 1000 + 5;
  const page = scriptedPage([
    { status: 200, body: { items: [{ id: "old", create_time: after - 3600 }, { id: "other", create_time: after }, { id: "ours", create_time: new Date(after * 1000).toISOString() }] } },
    turn("Reply with PING"), turn(prompt),
  ]);
  assert.equal(await findConversation(page, meta), "ours");
  assert.equal(page.calls(), 3, "the hour-old conversation is never opened");
});

test("an unbounded or absurd --timeout is refused before anything starts", () => {
  const engine = new URL("../scripts/pro-engine.mjs", import.meta.url).pathname;
  for (const timeout of ["9".repeat(309) + "s", "7h", "0s"]) {
    const run = spawnSync(process.execPath, [engine, "run", "--prompt-only", "--brief", "b.md", "--report", "r.md", "--timeout", timeout], { encoding: "utf8", cwd: dir });
    assert.equal(run.status, 2, timeout);
    assert.match(run.stderr, /between 1s and 6h/);
  }
});

test("a Pro failure names the locked effort step instead of a generic refusal", () => {
  const limited = proFailure("right before send", { label: "GPT-6 + Extra High", evidence: { observed: {}, afterSelect: { model: "GPT-6", steps: ["Instant", "Medium", "High", "Extra High"], effortStep: { locked: false } } } });
  assert.match(limited, /Instant > Medium > High > Extra High/);
  assert.match(limited, /locked, most likely by the Pro usage limit/);
  assert.match(proFailure("before typing", { label: "GPT-5.6 Sol + Pro", evidence: { observed: {}, afterSelect: { model: null, steps: [] } } }), /GPT-6 model row was not found/);
});

test("page scripts retry only while Chrome swaps the execution context", async () => {
  const replies = [new Error("pro-review transport: Runtime.evaluate failed: Cannot find default execution context"), { result: { value: 7 } }];
  let sent = 0;
  const page = new Page({ send: async () => { const next = replies[sent++]; if (next instanceof Error) throw next; return next; } }, "t", "s");
  assert.deepEqual([await page.evaluate("7"), sent], [7, 2]);
  const fatal = new Page({ send: async () => { sent += 1; throw new Error("pro-review transport: DevTools connection closed"); } }, "t", "s");
  sent = 0;
  await assert.rejects(fatal.evaluate("1"), /connection closed/);
  assert.equal(sent, 1);
});

test("the scope zip keeps paths and bytes, and is identical for identical files", async () => {
  const { zipEntries } = await import("../scripts/zip.mjs");
  const files = [{ path: "src/a.ts", bytes: Buffer.from("export const a = 1;\n".repeat(40)) }, { path: "docs/메모.md", bytes: Buffer.from("# 제목\n") }, { path: "e.bin", bytes: Buffer.from([0, 255]) }];
  const archive = zipEntries(files);
  assert.ok(archive.equals(zipEntries(files)), "deterministic");
  const zipPath = join(fresh(), "scope.zip");
  writeFileSync(zipPath, archive);
  const listed = spawnSync("python3", ["-I", "-c", "import sys,zipfile,hashlib,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({i.filename: hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist()}))", zipPath], { encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(JSON.parse(listed.stdout), Object.fromEntries(files.map((file) => [file.path, sha(file.bytes)])));
  assert.throws(() => zipEntries([{ path: "../x", bytes: Buffer.alloc(0) }]), /plain relative path/);
});

test("every prompt ends by stating exactly what was sent and that nothing else is visible", async () => {
  const { deliveryNote } = await import("../scripts/pro-engine.mjs");
  const zipped = deliveryNote({ zip: { name: "repo-pass1.zip", sha256: "ab".repeat(32) }, files: 3, pasted: true });
  assert.match(zipped, /repo-pass1\.zip: a zip of the 3 scoped file/);
  assert.match(zipped, /Python sandbox/);
  assert.match(zipped, /pasted below in full/);
  assert.match(deliveryNote({ zip: { name: "z.zip", sha256: "cd".repeat(32) }, files: 9, pasted: false }), /only in the zip/);
  const listed = deliveryNote({ zip: undefined, attachments: [{ name: "shot.png", kind: "image", size: 12, sha256: "ef".repeat(32), how: "look at it directly" }] });
  assert.match(listed, /shot\.png: image, 12 bytes \(sha256 efefefefefefefef\)\. Look at it directly\./);
  assert.doesNotMatch(listed, /No code, files or archive are attached/);
  assert.match(listed, /downloaded together with the report/);
  assert.match(listed, /download link, not only a sandbox path/);
  const none = deliveryNote({ zip: undefined });
  assert.match(none, /No code, files or archive are attached/);
  for (const note of [zipped, none]) assert.match(note, /cannot see the author's machine.*GitHub/s);
});

test("an upload tile matches its own name, or the name ChatGPT gives a repeat upload", () => {
  const tile = tilePattern("demo-project-pass1-a1b2c3.zip");
  for (const shown of ["demo-project-pass1-a1b2c3.zip", "demo-project-pass1-a1b2c3(1).zip", "demo-project-pass1-a1b2c3(12).zip"]) assert.ok(tile.test(shown), shown);
  for (const other of ["xdemo-project-pass1-a1b2c3.zip", "demo-project-pass1-a1b2c3.zip.txt", "demo-project-pass1Xa1b2c3.zip", "demo-project-pass1-a1b2c3(x).zip"]) assert.ok(!tile.test(other), other);
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
test("an attachment is classified by extension and magic bytes against ChatGPT's per-kind limits", async () => {
  const { classifyAttachment } = await import("../scripts/pro-engine.mjs");
  const MB = 1024 * 1024;
  assert.equal(classifyAttachment("shot.png", 1000, PNG).kind, "image");
  assert.equal(classifyAttachment("data.csv", 10, Buffer.from("a,b\n")).kind, "spreadsheet");
  assert.equal(classifyAttachment("spec.pdf", 10, Buffer.from("%PDF-1.7")).kind, "document");
  assert.equal(classifyAttachment("memo.docx", 10, Buffer.from([0x50, 0x4b, 3, 4])).kind, "document");
  assert.equal(classifyAttachment("tool.py", 10, Buffer.from("print()")).kind, "file", "other text files go to the sandbox");
  assert.throws(() => classifyAttachment("shot.png", 1000, Buffer.from("not an image")), /does not contain PNG data/);
  assert.throws(() => classifyAttachment("big.png", 21 * MB, PNG), /at most 20 MB for a image/);
  assert.throws(() => classifyAttachment("big.csv", 51 * MB, Buffer.from("a")), /at most 50 MB/);
  assert.throws(() => classifyAttachment("huge.pdf", 513 * MB, Buffer.from("%PDF-")), /at most 512 MB/);
  assert.throws(() => classifyAttachment("setup.exe", 10, Buffer.from("MZ")), /executables/);
  assert.throws(() => classifyAttachment("empty.txt", 0, Buffer.alloc(0)), /is empty/);
});

test("attachments are refused before anything starts: links, secret paths, duplicate names, too many", async () => {
  const { prepareAttachments } = await import("../scripts/pro-engine.mjs");
  const box = fresh();
  writeFileSync(join(box, "a.png"), PNG);
  mkdirSync(join(box, "sub"));
  writeFileSync(join(box, "sub", "a.png"), PNG);
  writeFileSync(join(box, ".env"), "KEY=1");
  symlinkSync(join(box, "a.png"), join(box, "link.png"));
  const ok = prepareAttachments([join(box, "a.png")]);
  assert.deepEqual([ok[0].name, ok[0].kind, ok[0].size], ["a.png", "image", PNG.length]);
  assert.throws(() => prepareAttachments([join(box, "link.png")]), /not a link/);
  assert.throws(() => prepareAttachments([join(box, ".env")]), /path policy/);
  assert.throws(() => prepareAttachments([join(box, "a.png"), join(box, "sub", "a.png")]), /two uploads are named a\.png/);
  assert.throws(() => prepareAttachments([join(box, "a.png")], [{ name: "a.png" }]), /two uploads/);
  const many = Array.from({ length: 10 }, (_, index) => { const file = join(box, "f" + index + ".txt"); writeFileSync(file, "x"); return file; });
  assert.throws(() => prepareAttachments(many, [{ name: "scope.zip" }]), /at most 10/);
});

test("files Pro created are found from save receipts, generated images and links; failures never count", () => {
  const text = (body) => ({ author: { role: "tool" }, recipient: "all", content: { content_type: "execution_output", text: body } });
  const receipt = (path, id) => "__OPENAI_LIBRARY_FILE_WRITE_RECEIPT_V1__=" + JSON.stringify({ sandbox_path: path, file_id: id, library_file_id: "lib" });
  const final = "- [chart.png](sandbox:/w/out/chart.png)\n- [lost.txt](sandbox:/mnt/data/lost.txt)";
  const conversation = { current_node: "f", mapping: {
    u: { parent: null, message: { author: { role: "user" }, content: { content_type: "multimodal_text", parts: [{ content_type: "image_asset_pointer", asset_pointer: "sediment://file_UPLOAD" }, "q"] } } },
    a: { parent: "u", message: text("library upload failed: network") },
    b: { parent: "a", message: text(receipt("/w/out/chart.png", "file_A") + "\n" + receipt("/w/out/codes.txt", "file_B")) },
    g: { parent: "b", message: { author: { role: "assistant" }, recipient: "all", content: { content_type: "multimodal_text", parts: [{ content_type: "image_asset_pointer", asset_pointer: "sediment://file_IMG" }] } } },
    f: { parent: "g", message: { author: { role: "assistant" }, recipient: "all", content: { content_type: "text", parts: [final] } } } } };
  const found = outputFiles(conversation, final).map((item) => [item.name, item.fileId, item.source]);
  assert.deepEqual(found, [["image-1.png", "file_IMG", "generated image"], ["chart.png", "file_A", "saved file"], ["codes.txt", "file_B", "saved file"], ["lost.txt", null, "linked without a saved copy"]]);
  assert.ok(!found.some(([, id]) => id === "file_UPLOAD"), "the user's own upload is never an output");
});

test("Pro's files are saved beside the report with safe names, no overwrite, and a manifest", async () => {
  const { saveOutputs } = await import("../scripts/pro-engine.mjs");
  const report = join(fresh(), "report-pass1.md");
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const outputs = [
    { name: "chart.png", bytes: PNG, sha256: sha(PNG), source: "saved file" },
    { name: "../../etc/evil sh", bytes: Buffer.from("x"), sha256: sha("x"), source: "saved file" },
    { name: "chart.png", bytes: Buffer.from("y"), sha256: sha("y"), source: "saved file" },
    { name: "lost.txt", error: "ChatGPT kept no downloadable copy", source: "linked without a saved copy" },
  ];
  const dir = saveOutputs(report, outputs);
  assert.equal(dir, report + ".files");
  assert.deepEqual(readdirSync(dir).sort(), ["MANIFEST.json", "chart-2.png", "chart.png", "evil_sh"]);
  const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8"));
  assert.deepEqual(manifest.map((item) => item.error ? "error" : item.name), ["chart.png", "evil_sh", "chart-2.png", "error"]);
  assert.equal(manifest[0].sha256, sha(PNG));
  assert.equal(saveOutputs(report, outputs), undefined, "an existing directory is never written into");
  assert.ok(existsSync(join(dir, "chart.png")));
});

test("plan shows every upload a run would send", () => {
  const box = fresh();
  writeFileSync(join(box, "brief.md"), "Look at the screenshot.");
  writeFileSync(join(box, "shot.png"), PNG);
  const engine = new URL("../scripts/pro-engine.mjs", import.meta.url).pathname;
  const plan = spawnSync(process.execPath, [engine, "plan", "--prompt-only", "--brief", "brief.md", "--report", "r.md", "--attach", "shot.png"], { encoding: "utf8", cwd: box });
  assert.equal(plan.status, 0, plan.stderr);
  assert.deepEqual(JSON.parse(plan.stdout).uploads.map((item) => [item.name, item.kind]), [["shot.png", "image"]]);
  const bad = spawnSync(process.execPath, [engine, "plan", "--prompt-only", "--brief", "brief.md", "--report", "r.md", "--attach", "brief.md", "--attach", "missing.pdf"], { encoding: "utf8", cwd: box });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /attachment not found/);
});

test("a file Pro saved for the user is found from the answer's content references, once", () => {
  const final = "**Corrected file:** [core.py](https://chatgpt.com/library?file_id=libfile_7c16&account_id=personal) and [core.py](sandbox:/w/out/core.py)";
  const conversation = { current_node: "f", mapping: {
    u: { parent: null, message: { author: { role: "user" }, content: { content_type: "text", parts: ["q"] } } },
    f: { parent: "u", message: { author: { role: "assistant" }, recipient: "all", content: { content_type: "text", parts: [final] },
      metadata: { content_references: [{ type: "file", name: "core.py", id: "file_00000000c970", source: "my_files", library_file_id: "libfile_7c16" }, { type: "webpage", url: "https://x" }] } } } } };
  assert.deepEqual(outputFiles(conversation, final).map((item) => [item.name, item.fileId, item.source]), [["core.py", "file_00000000c970", "saved file"]]);
});

test("headless Chrome's own new-tab page never keeps a finished run's browser alive", () => {
  for (const url of ["about:blank", "chrome://newtab/", "chrome://new-tab-page/", ""]) assert.ok(isBlankTarget(url), url);
  for (const url of ["https://chatgpt.com/", "https://chatgpt.com/library?file_id=x"]) assert.ok(!isBlankTarget(url), url);
});

test("a file ChatGPT renamed in the Library keeps its real name and matches its link", () => {
  assert.deepEqual(["core(1).py", "core(12).py", "README(3)", "a(b).py", "core.py"].map(withoutRename), ["core.py", "core.py", "README", "a(b).py", "core.py"]);
  const final = "[core.py](https://chatgpt.com/library?file_id=libfile_x) and [core.py](sandbox:/w/out/core.py)";
  const conversation = { current_node: "f", mapping: {
    u: { parent: null, message: { author: { role: "user" }, content: { content_type: "text", parts: ["q"] } } },
    f: { parent: "u", message: { author: { role: "assistant" }, recipient: "all", content: { content_type: "text", parts: [final] },
      metadata: { content_references: [{ type: "file", name: "core(1).py", id: "file_9", library_file_id: "libfile_x" }] } } } } };
  assert.deepEqual(outputFiles(conversation, final).map((item) => [item.name, item.fileId]), [["core.py", "file_9"]]);
});
