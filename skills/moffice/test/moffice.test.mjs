import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const skillDir = fileURLToPath(new URL("..", import.meta.url));

// Drives the real CLI; only the AppleScript boundary (`run`) and the app inventory are replaced.
// The fake `run` performs the file effect Office would have, on whatever path it is handed.
const probe = String.raw`
import json, os, pathlib, subprocess, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.environ["SKILL_DIR"])
import scripts._office as office
import scripts._word as word_mod
import scripts._excel as excel_mod
import scripts._powerpoint as ppt_mod
import scripts.moffice as cli
office.STAGE_ROOT = pathlib.Path(os.environ["STAGE_ROOT"])
cli.apps = lambda: {name: {"installed": True, "version": "test"} for name in ("Word", "Excel", "PowerPoint", "Outlook", "OneNote", "Teams", "OneDrive")}
mode = os.environ["FAKE_MODE"]
calls = []
def fake_run(app, body, *args):
    calls.append({"app": app, "args": list(args)})
    if mode == "fail":
        raise office.OfficeError("Office refused the operation")
    if mode == "create":
        pathlib.Path(args[0]).write_bytes(b"created by office")
    elif mode == "modify":
        path = pathlib.Path(args[0])
        path.write_bytes(path.read_bytes() + b"+edited")
    elif mode == "export":
        pathlib.Path(args[1]).write_bytes(b"%PDF fake")
    return ["created"]
for module in (word_mod, excel_mod, ppt_mod):
    module.run = fake_run
import contextlib, io
out = io.StringIO()
with contextlib.redirect_stdout(out):
    code = cli.main(json.loads(os.environ["ARGV"]))
print("__RECEIPT__" + json.dumps({"code": code, "stdout": out.getvalue(), "calls": calls}))
`;

function runCli({ argv, mode, prepare }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "moffice-test-")));
  const docs = join(root, "Documents");
  const stage = join(root, "stage");
  mkdirSync(docs);
  try {
    prepare?.(docs);
    const resolved = argv.map((arg) => arg.replaceAll("<DOCS>", docs));
    const run = spawnSync("python3", ["-B", "-c", probe], {
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, SKILL_DIR: skillDir, STAGE_ROOT: stage, FAKE_MODE: mode, ARGV: JSON.stringify([...resolved, "--json"]) },
    });
    const marker = run.stdout.lastIndexOf("__RECEIPT__");
    assert.notEqual(marker, -1, run.stderr);
    const receipt = JSON.parse(run.stdout.slice(marker + "__RECEIPT__".length));
    const files = Object.fromEntries(readdirSync(docs).map((name) => [name, readFileSync(join(docs, name), "utf8")]));
    const stageLeft = existsSync(stage) ? readdirSync(stage) : [];
    const output = receipt.stdout.trim() ? JSON.parse(receipt.stdout.trim()) : null;
    return { ...receipt, output, files, stageLeft, docs, stage };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("create is staged in Office's container, then published to the real path", () => {
  const result = runCli({ argv: ["word", "create", "<DOCS>/new.docx", "--text", "Hello"], mode: "create" });
  assert.equal(result.code, 0, JSON.stringify(result));
  // Office only ever touched the staged copy, never the user's folder (no sandbox prompt).
  assert.ok(result.calls[0].args[0].startsWith(result.stage), result.calls[0].args[0]);
  assert.deepEqual(result.files, { "new.docx": "created by office" });
  assert.equal(result.output.file, join(result.docs, "new.docx"));
  assert.deepEqual(result.stageLeft, []);
});

test("an edit works on a staged copy and replaces the original only after success", () => {
  const result = runCli({
    argv: ["word", "append", "<DOCS>/doc.docx", "--text", "More"],
    mode: "modify",
    prepare: (docs) => writeFileSync(join(docs, "doc.docx"), "original"),
  });
  assert.equal(result.code, 0, JSON.stringify(result));
  assert.ok(result.calls[0].args[0].startsWith(result.stage));
  assert.deepEqual(result.files, { "doc.docx": "original+edited" });
  assert.equal(result.output.file, join(result.docs, "doc.docx"));
  assert.deepEqual(result.stageLeft, []);
});

test("an export writes the PDF to the real path and leaves the source untouched", () => {
  const result = runCli({
    argv: ["word", "export-pdf", "<DOCS>/doc.docx", "<DOCS>/doc.pdf"],
    mode: "export",
    prepare: (docs) => writeFileSync(join(docs, "doc.docx"), "original"),
  });
  assert.equal(result.code, 0, JSON.stringify(result));
  assert.ok(result.calls[0].args.every((arg) => !arg.startsWith(result.docs)), JSON.stringify(result.calls[0].args));
  assert.deepEqual(result.files, { "doc.docx": "original", "doc.pdf": "%PDF fake" });
  assert.equal(result.output.file, join(result.docs, "doc.pdf"));
  assert.deepEqual(result.stageLeft, []);
});

test("a failed operation publishes nothing, keeps the original, and cleans the stage", () => {
  const result = runCli({
    argv: ["word", "append", "<DOCS>/doc.docx", "--text", "More"],
    mode: "fail",
    prepare: (docs) => writeFileSync(join(docs, "doc.docx"), "original"),
  });
  assert.equal(result.code, 1);
  assert.match(result.output.error, /Office refused/);
  assert.deepEqual(result.files, { "doc.docx": "original" });
  assert.deepEqual(result.stageLeft, []);
});

test("create never overwrites an existing file and never calls Office", () => {
  const result = runCli({
    argv: ["excel", "new", "<DOCS>/book.xlsx"],
    mode: "create",
    prepare: (docs) => writeFileSync(join(docs, "book.xlsx"), "mine"),
  });
  assert.equal(result.code, 1);
  assert.match(result.output.error, /already exists/);
  assert.equal(result.calls.length, 0);
  assert.deepEqual(result.files, { "book.xlsx": "mine" });
});

// Exercises the real transport with osascript replaced: a hang must be reported as a hang, not as a
// permission denial, and an app the helper launched must be asked to quit.
const timeoutProbe = String.raw`
import json, os, subprocess, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.environ["SKILL_DIR"])
import scripts._office as office
calls = []
running = {"value": False}
def fake_run(argv, **kwargs):
    calls.append(argv)
    if argv[0] == "/usr/bin/pgrep":
        return subprocess.CompletedProcess(argv, 0 if running["value"] else 1, "", "")
    if "--" in argv:
        running["value"] = True
        raise subprocess.TimeoutExpired(argv, kwargs.get("timeout"))
    running["value"] = False
    return subprocess.CompletedProcess(argv, 0, "", "")
office.subprocess.run = fake_run
try:
    office.run("Word", "set answerText to \"x\"")
    message = None
except office.OfficeError as error:
    message = str(error)
quits = [c for c in calls if c[0] == "/usr/bin/osascript" and "--" not in c]
print(json.dumps({"message": message, "quitAttempts": len(quits), "quitScript": quits[0][2] if quits else None}))
`;

test("a hung Office call is reported as a hang and the helper-launched app is quit", () => {
  const run = spawnSync("python3", ["-B", "-c", timeoutProbe], { encoding: "utf8", timeout: 10_000, env: { ...process.env, SKILL_DIR: skillDir } });
  const result = JSON.parse(run.stdout.trim().split("\n").at(-1));
  assert.match(result.message, /did not respond/);
  assert.doesNotMatch(result.message, /pending or denied/);
  assert.equal(result.quitAttempts, 1);
  assert.match(result.quitScript, /Microsoft Word.*quit saving no/s);
});
