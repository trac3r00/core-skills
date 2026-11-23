import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chatPrompt, createBridgeServer, diffPaths, handleMessage, issueToken, loadScope, tunnelProfile } from "../scripts/bridge.mjs";

const HANDOFF = fileURLToPath(new URL("../scripts/handoff.mjs", import.meta.url));
let root;
let repo;
let manifestPath;

function plan(out, targets) {
  const run = spawnSync(process.execPath, [HANDOFF, "plan", "--repo", repo, ...targets.flatMap((target) => ["--target", target]), "--question", "Is add() correct?", "--out", out], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  return join(out, "manifest.json");
}

before(() => {
  root = mkdtempSync(join(os.tmpdir(), "pro-review-bridge-test-"));
  repo = join(root, "repo");
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "src/math.js"), "export function add(a, b) {\n  return a - b;\n}\n");
  writeFileSync(join(repo, "src/other.js"), "export const other = 1;\n");
  writeFileSync(join(repo, ".env"), "TOKEN=not-for-the-reviewer\n");
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "add", "-A"], { cwd: repo });
  execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "init"], { cwd: repo });
  manifestPath = plan(join(root, "handoff"), ["src/math.js", ".env"]);
});
after(() => rmSync(root, { recursive: true, force: true }));

const call = (scope, name, args = {}) => handleMessage(scope, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }).result;
const body = (result) => result.content[0].text;

function report(scope, verdict = "REQUEST_CHANGES") {
  return [
    "# OmO Pro Review", "", "## Verdict", "", verdict, "", "## Scope", "", "- reviewed: `src/math.js`", "",
    "## Findings", "", "| severity | location | finding | impact | fix |", "| --- | --- | --- | --- | --- |",
    "| high | `src/math.js:2` | add subtracts | wrong sums | use a + b |", "",
    "## Checks run", "", "- none run; read only", "", "## Limits", "", "- static reading only", "", scope.marker, "",
  ].join("\n");
}

test("the scope is exactly the planned files; excluded and unplanned paths are unreadable", () => {
  const scope = loadScope(manifestPath);
  assert.deepEqual([...scope.files.keys()], ["src/math.js"]);
  const view = JSON.parse(body(call(scope, "get_review_scope")));
  assert.deepEqual(view.files.map((file) => file.path), ["src/math.js"]);
  assert.equal(view.marker, scope.marker);
  assert.match(body(call(scope, "read_file", { path: "src/math.js", start_line: 2, end_line: 2 })), /2\t  return a - b;/);
  for (const path of [".env", "src/other.js", "../repo/src/math.js", "/etc/hosts"]) {
    const result = call(scope, "read_file", { path });
    assert.equal(result.isError, true, path);
    assert.doesNotMatch(body(result), /not-for-the-reviewer/);
  }
  assert.match(body(call(scope, "search_text", { query: "A - B" })), /^src\/math\.js:2: /);
  assert.equal(body(call(scope, "search_text", { query: "TOKEN" })), "no matches in the review scope");
  assert.equal(call(scope, "read_file", { path: "src/math.js", extra: 1 }).isError, true);
});

test("a file changed after planning refuses the whole bridge", () => {
  const out = join(root, "changed");
  const manifest = plan(out, ["src/other.js"]);
  writeFileSync(join(repo, "src/other.js"), "export const other = 2;\n");
  try {
    assert.throws(() => loadScope(manifest), /changed since the handoff was planned/);
  } finally {
    execFileSync("git", ["checkout", "-q", "--", "src/other.js"], { cwd: repo });
  }
});

test("tools advertise read-only hints only for reading tools", () => {
  const scope = loadScope(manifestPath);
  const tools = handleMessage(scope, { jsonrpc: "2.0", id: 2, method: "tools/list" }).result.tools;
  const hints = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations.readOnlyHint]));
  assert.deepEqual(hints, { get_review_scope: true, read_file: true, search_text: true, submit_report: false, propose_patch: false });
  assert.equal(handleMessage(scope, { jsonrpc: "2.0", method: "notifications/initialized" }), undefined);
  assert.equal(handleMessage(scope, { jsonrpc: "2.0", id: 3, method: "initialize", params: { protocolVersion: "2025-06-18" } }).result.protocolVersion, "2025-06-18");
});

test("propose_patch stores a reviewable diff and never changes the repository", () => {
  const scope = loadScope(manifestPath);
  const diff = "--- a/src/math.js\n+++ b/src/math.js\n@@ -1,3 +1,3 @@\n export function add(a, b) {\n-  return a - b;\n+  return a + b;\n }\n";
  assert.deepEqual(diffPaths(diff), ["src/math.js"]);
  const rename = "diff --git a/src/math.js b/src/other.js\nsimilarity index 100%\nrename from src/math.js\nrename to src/other.js\n";
  assert.deepEqual(diffPaths(rename), ["src/math.js", "src/other.js"]);
  assert.equal(call(scope, "propose_patch", { summary: "move", diff: rename }).isError, true);
  assert.match(body(call(scope, "propose_patch", { summary: "fix add", diff })), /proposals\/001\.patch \(not applied\)$/);
  const stored = readFileSync(join(scope.dir, "proposals", "001.patch"), "utf8");
  assert.match(stored, /^# summary: fix add\n# applies cleanly: yes\n/);
  assert.equal(readFileSync(join(repo, "src/math.js"), "utf8").includes("a - b"), true);
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" }), "");
  const outside = call(scope, "propose_patch", { summary: "x", diff: diff.replaceAll("src/math.js", "src/other.js") });
  assert.equal(outside.isError, true);
  assert.equal(readdirSync(join(scope.dir, "proposals")).length, 1);
});

test("submit_report rejects an incomplete report without occupying the path, then publishes once", () => {
  const out = join(root, "report");
  const scope = loadScope(plan(out, ["src/math.js"]));
  const wrong = call(scope, "submit_report", { report: report(scope).replace(scope.marker, "PRO_REVIEW_DONE PR-00000000") });
  assert.equal(wrong.isError, true);
  assert.match(body(wrong), /marker line must be exactly/);
  assert.equal(existsSync(scope.report), false);
  assert.equal(call(scope, "submit_report", { report: report(scope, "MAYBE") }).isError, true);
  assert.equal(call(scope, "submit_report", { report: report(scope) }).isError, undefined);
  const verify = spawnSync(process.execPath, [HANDOFF, "verify", "--report", scope.report, "--manifest", join(out, "manifest.json"), "--format", "json"], { encoding: "utf8" });
  assert.equal(verify.status, 0, verify.stdout);
  const again = call(scope, "submit_report", { report: report(scope, "APPROVE") });
  assert.equal(again.isError, true);
  assert.match(readFileSync(scope.report, "utf8"), /REQUEST_CHANGES/);
});

test("HTTP endpoint requires the issued bearer token and answers MCP over POST /mcp", async () => {
  const scope = loadScope(manifestPath);
  const { token, file } = issueToken(scope.dir);
  assert.equal(readFileSync(file, "utf8"), "Bearer " + token);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const server = createBridgeServer(scope, token);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port + "/mcp";
  const post = (payload, auth) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(payload) });
  try {
    assert.equal((await post({ jsonrpc: "2.0", id: 1, method: "ping" })).status, 401);
    assert.equal((await post({ jsonrpc: "2.0", id: 1, method: "ping" }, "Bearer " + "0".repeat(64))).status, 401);
    const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "0" } } }, "Bearer " + token);
    assert.equal(init.status, 200);
    assert.equal((await init.json()).result.serverInfo.name, "omo-pro-review-bridge");
    assert.equal((await post({ jsonrpc: "2.0", method: "notifications/initialized" }, "Bearer " + token)).status, 202);
    const read = await (await post({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "read_file", arguments: { path: "src/math.js" } } }, "Bearer " + token)).json();
    assert.match(read.result.content[0].text, /return a - b/);
    assert.equal((await fetch(url, { headers: { authorization: "Bearer " + token } })).status, 405);
    const audit = readFileSync(join(scope.dir, "access.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(audit.at(-1).tool, "read_file");
  } finally {
    server.close();
  }
});

test("tunnel profile keeps secrets as references and the chat prompt carries the bound brief", () => {
  const scope = loadScope(manifestPath);
  const yaml = tunnelProfile({ tunnelId: "tunnel_" + "a".repeat(32), authorizationFile: "/x/bridge/authorization" });
  assert.match(yaml, /api_key: env:CONTROL_PLANE_API_KEY/);
  assert.match(yaml, /Authorization: "file:\/x\/bridge\/authorization"/);
  assert.match(yaml, /url: "http:\/\/127\.0\.0\.1:3747\/mcp"/);
  assert.doesNotMatch(yaml, /sk-/);
  assert.throws(() => tunnelProfile({ tunnelId: "tunnel_123", authorizationFile: "/x" }), /tunnel-id/);
  const prompt = chatPrompt(scope);
  assert.ok(prompt.endsWith(scope.brief));
  assert.match(prompt, /submit_report/);
});
