import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/session.mjs", import.meta.url));
const artifact = "https://claude.ai/artifact/design-1";
const chat = "https://claude.ai/chat/chat-1";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "claude-design-session-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = join(root, "run");
  const brief = join(root, "brief.md");
  const prompt = join(root, "prompt.md");
  const evidence = join(root, "evidence.txt");
  writeFileSync(brief, "Build a design");
  writeFileSync(prompt, "Change the layout");
  writeFileSync(evidence, "Observed result");
  function cli(command, flags = {}, expectedCode = 0) {
    const args = [script, command, "--run", run];
    for (const [key, value] of Object.entries(flags)) args.push(`--${key}`, String(value));
    const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 5000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, expectedCode, result.stderr);
    assert.equal(expectedCode === 0 ? result.stderr : result.stdout, "");
    const parsed = JSON.parse(expectedCode === 0 ? result.stdout : result.stderr);
    if (expectedCode !== 0) assert.equal(typeof parsed.error.code, "string");
    return parsed;
  }
  const status = () => cli("status");
  const init = (flags = {}) => cli("init", { brief, checks: "layout,interaction", ...flags });
  const mutate = (command, flags = {}) => cli(command, { "expected-revision": status().revision, ...flags });
  const begin = (kind = "create") => mutate("begin", { kind, prompt });
  const resolveOperation = (flags = {}) => mutate("resolve", { operation: status().pendingOperation.id, evidence, ...flags });
  const pass = () => {
    for (const id of ["layout", "interaction"]) mutate("check", { id, status: "pass", evidence });
  };
  return { root, run, brief, prompt, evidence, cli, status, init, mutate, begin, resolveOperation, pass };
}

test("init persists hashes and reopens across processes without overwriting", (t) => {
  const box = fixture(t);
  const state = box.init();
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.artifactType, "design");
  assert.equal(state.revision, 0);
  assert.equal(state.designRevision, 0);
  assert.deepEqual(state.goal, { path: box.brief, sha256: sha256("Build a design") });
  assert.equal(state.artifactUrl, null);
  assert.equal(state.chatUrl, null);
  assert.equal(state.pendingOperation, null);
  assert.equal(state.completed, false);
  assert.equal(state.resumeAction, "continue");
  assert.deepEqual(state.checks.map(({ status, evidence }) => ({ status, evidence })),
    [{ status: "pending", evidence: null }, { status: "pending", evidence: null }]);
  assert.deepEqual(box.status(), state);
  box.cli("init", { brief: box.brief, checks: "other" }, 2);
  assert.deepEqual(box.status(), state);
  assert.equal(JSON.parse(readFileSync(join(box.run, "session.json"), "utf8")).revision, 0);
});

test("pending intents survive restart and require matching evidence-backed resolution", (t) => {
  const box = fixture(t);
  box.init();
  const pending = box.begin();
  assert.equal(pending.revision, 1);
  assert.equal(pending.designRevision, 1);
  assert.deepEqual(pending.pendingOperation, {
    id: pending.pendingOperation.id, kind: "create", promptPath: box.prompt, promptSha256: sha256("Change the layout"),
  });
  assert.equal(box.status().resumeAction, "reconcile-pending");
  box.cli("begin", { "expected-revision": 1, kind: "create", prompt: box.prompt }, 2);
  box.cli("check", { "expected-revision": 1, id: "layout", status: "pass", evidence: box.evidence }, 2);
  box.cli("resolve", { "expected-revision": 1, operation: "wrong", evidence: box.evidence, artifact }, 2);
  box.cli("resolve", { "expected-revision": 1, operation: pending.pendingOperation.id, evidence: box.evidence }, 2);
  box.cli("resolve", { "expected-revision": 1, operation: pending.pendingOperation.id, evidence: box.root, artifact }, 2);
  assert.deepEqual(box.status(), pending);
  const resolved = box.resolveOperation({ artifact, chat });
  assert.equal(resolved.artifactUrl, artifact);
  assert.equal(resolved.chatUrl, chat);
  assert.equal(resolved.pendingOperation, null);
  assert.equal(resolved.history.at(-1).operation.id, pending.pendingOperation.id);
  assert.deepEqual(resolved.history.at(-1).evidence, { path: box.evidence, sha256: sha256("Observed result") });
  assert.equal(resolved.history.at(-1).outcome, "completed");
  box.cli("resolve", { "expected-revision": 2, operation: pending.pendingOperation.id, evidence: box.evidence, artifact }, 2);
  box.cli("begin", { "expected-revision": 2, kind: "create", prompt: box.prompt }, 2);
});

test("stale revisions and held locks fail without touching state or another owner's lock", (t) => {
  const box = fixture(t);
  box.init({ artifact });
  const before = readFileSync(join(box.run, "session.json"), "utf8");
  box.cli("begin", { "expected-revision": 9, kind: "revise", prompt: box.prompt }, 2);
  writeFileSync(join(box.run, ".lock"), "owner");
  box.cli("begin", { "expected-revision": 0, kind: "revise", prompt: box.prompt }, 2);
  box.cli("init", { brief: box.brief, checks: "layout" }, 2);
  assert.equal(readFileSync(join(box.run, ".lock"), "utf8"), "owner");
  assert.equal(readFileSync(join(box.run, "session.json"), "utf8"), before);
  rmSync(join(box.run, ".lock"));
  box.begin("revise");
  box.cli("resolve", { "expected-revision": 0, operation: box.status().pendingOperation.id, evidence: box.evidence }, 2);
  assert.equal(box.status().revision, 1);
  assert.equal(existsSync(join(box.run, ".lock")), false);
});

test("not-applied requires explicit evidence and reconciles even when the brief changed", (t) => {
  const box = fixture(t);
  box.init();
  const pending = box.begin();
  writeFileSync(box.brief, "New brief");
  box.cli("begin", { "expected-revision": 1, kind: "create", prompt: box.prompt }, 2);
  box.cli("resolve", { "expected-revision": 1, operation: pending.pendingOperation.id,
    outcome: "not-applied", evidence: join(box.root, "missing") }, 2);
  assert.equal(box.status().resumeAction, "reconcile-pending");
  const resolved = box.resolveOperation({ outcome: "not-applied" });
  assert.equal(resolved.pendingOperation, null);
  assert.equal(resolved.artifactUrl, null);
  assert.equal(resolved.resumeAction, "revalidate");
  assert.equal(resolved.history.at(-1).outcome, "not-applied");
  const next = box.begin();
  assert.notEqual(next.pendingOperation.id, pending.pendingOperation.id);
  assert.equal(next.goal.sha256, sha256("New brief"));
  assert.equal(next.history[1].goal.sha256, sha256("Build a design"));
});

test("all non-export intents invalidate checks; export preserves checks and completion", (t) => {
  const box = fixture(t);
  box.init({ artifact });
  box.pass();
  box.mutate("complete");
  const before = box.status();
  const pendingExport = box.begin("export");
  assert.equal(pendingExport.completed, false);
  assert.equal(pendingExport.resumeAction, "reconcile-pending");
  const exported = box.resolveOperation();
  assert.deepEqual(exported.checks, before.checks);
  assert.equal(exported.designRevision, 0);
  assert.equal(exported.completed, true);
  for (const kind of ["revise", "comment", "edit"]) {
    const pending = box.begin(kind);
    assert.equal(pending.completed, false);
    assert.ok(pending.checks.every(({ status, evidence }) => status === "pending" && evidence === null));
    box.resolveOperation();
    box.pass();
    box.mutate("complete");
  }
  assert.equal(box.status().designRevision, 3);
  assert.deepEqual(box.status().history.map(({ revision }) => revision),
    Array.from({ length: box.status().revision + 1 }, (_, i) => i));
});

test("completion requires artifact, all planned checks, no pending intent, and current hashes", (t) => {
  const box = fixture(t);
  box.init();
  box.pass();
  box.cli("complete", { "expected-revision": box.status().revision }, 2);
  box.begin();
  box.cli("complete", { "expected-revision": box.status().revision }, 2);
  box.resolveOperation({ artifact: "https://claude.ai/code/artifact/design-2" });
  for (const status of ["fail", "blocked"]) {
    box.mutate("check", { id: "layout", status, evidence: box.evidence });
    box.cli("complete", { "expected-revision": box.status().revision }, 2);
  }
  box.mutate("check", { id: "layout", status: "pass", evidence: box.evidence });
  box.cli("complete", { "expected-revision": box.status().revision }, 2);
  box.pass();
  const complete = box.mutate("complete");
  assert.equal(complete.completed, true);
  assert.equal(box.status().resumeAction, "complete");
  writeFileSync(box.evidence, "Changed evidence");
  assert.equal(box.status().completed, false);
  assert.equal(box.status().resumeAction, "revalidate");
  assert.deepEqual(box.status().drift.checks, ["layout", "interaction"]);
  box.cli("complete", { "expected-revision": box.status().revision }, 2);
  box.pass();
  box.mutate("complete");
  rmSync(box.evidence);
  assert.equal(box.status().resumeAction, "revalidate");
  box.cli("complete", { "expected-revision": box.status().revision }, 2);
  writeFileSync(box.evidence, "Fresh evidence");
  box.pass();
  writeFileSync(box.brief, "Changed goal");
  assert.equal(box.status().drift.brief, true);
  box.cli("complete", { "expected-revision": box.status().revision }, 2);
  box.begin("export");
  box.resolveOperation();
  assert.equal(box.status().resumeAction, "revalidate");
  box.begin("revise");
  box.resolveOperation();
  box.pass();
  assert.equal(box.mutate("complete").completed, true);
});

test("strict flags, IDs, revisions, URL shapes, and real files are enforced", (t) => {
  const box = fixture(t);
  for (const checks of ["x,x", "x,", ",x", " x", ""]) {
    box.cli("init", { brief: box.brief, checks }, 2);
  }
  for (const url of ["http://claude.ai/artifact/a", "https://claude.ai.evil/artifact/a",
    "https://user@claude.ai/artifact/a", "https://claude.ai/artifact/a?q=x",
    "https://claude.ai/artifact/a#", "https://claude.ai/artifact/a?",
    "https://claude.ai/artifact/a/frame", "https://example.com/artifact/a",
    "https://claude.ai:443/artifact/a", "https://claude.ai/artifact/%2f",
    "https://claude.ai/chat/a"]) {
    box.cli("init", { brief: box.brief, checks: "layout", artifact: url }, 2);
  }
  box.cli("init", { brief: box.brief, checks: "layout", chat: artifact }, 2);
  box.cli("init", { brief: box.root, checks: "layout" }, 2);
  box.cli("init", { brief: join(box.root, "missing"), checks: "layout" }, 2);
  box.init();
  box.cli("status", { extra: "value" }, 2);
  box.cli("unknown", {}, 2);
  box.cli("begin", { kind: "create", prompt: box.prompt }, 2);
  for (const revision of ["-1", "1.5", "NaN", "01", "9007199254740992"]) {
    box.cli("begin", { "expected-revision": revision, kind: "create", prompt: box.prompt }, 2);
  }
  for (const kind of ["revise", "comment", "edit", "export", "unknown"]) {
    box.cli("begin", { "expected-revision": 0, kind, prompt: box.prompt }, 2);
  }
  box.cli("begin", { "expected-revision": 0, kind: "create", prompt: join(box.root, "missing") }, 2);
  box.cli("check", { "expected-revision": 0, id: "unknown", status: "pass", evidence: box.evidence }, 2);
  box.cli("check", { "expected-revision": 0, id: "layout", status: "pending", evidence: box.evidence }, 2);
  box.cli("check", { "expected-revision": 0, id: "layout", status: "pass", evidence: join(box.root, "missing") }, 2);
  const duplicate = spawnSync(process.execPath, [script, "status", "--run", box.run, "--run", box.run], { encoding: "utf8" });
  assert.equal(duplicate.status, 2);
  assert.equal(JSON.parse(duplicate.stderr).error.code, "invalid_arguments");
  assert.equal(box.status().revision, 0);
});

test("artifact type persists through restart and pending-operation reconciliation", (t) => {
  for (const type of ["docs", "slides", "design", "dashboard"]) {
    const box = fixture(t);
    assert.equal(box.init({ type }).artifactType, type);
    const pending = box.begin();
    assert.equal(box.status().artifactType, type);
    assert.equal(box.status().pendingOperation.id, pending.pendingOperation.id);
    const resolved = box.resolveOperation({ artifact });
    assert.equal(resolved.artifactType, type);
    assert.equal(box.status().artifactType, type);
  }
});

test("unknown artifact types are rejected before creating a run", (t) => {
  const box = fixture(t);
  const result = box.cli("init", { brief: box.brief, checks: "layout", type: "unknown" }, 2);
  assert.equal(result.error.code, "invalid_type");
  assert.equal(existsSync(join(box.run, "session.json")), false);
});

test("resolution cannot carry passing checks onto a different artifact", (t) => {
  const box = fixture(t);
  box.init({ artifact });
  box.pass();
  const pending = box.begin("export");
  const result = box.cli("resolve", {
    "expected-revision": pending.revision,
    operation: pending.pendingOperation.id,
    artifact: "https://claude.ai/artifact/another-design",
    evidence: box.evidence,
  }, 2);
  assert.equal(result.error.code, "artifact_mismatch");
  assert.equal(box.status().artifactUrl, artifact);
  assert.equal(box.status().pendingOperation.id, pending.pendingOperation.id);
});

test("empty prompt and evidence files do not satisfy operation gates", (t) => {
  const box = fixture(t);
  box.init({ artifact });
  writeFileSync(box.prompt, "");
  box.cli("begin", { "expected-revision": 0, kind: "revise", prompt: box.prompt }, 2);
  writeFileSync(box.evidence, "");
  box.cli("check", { "expected-revision": 0, id: "layout", status: "pass", evidence: box.evidence }, 2);
  assert.equal(box.status().revision, 0);
});
