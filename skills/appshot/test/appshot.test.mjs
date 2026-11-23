import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("../scripts/appshot.py", import.meta.url));
const cases = process.argv.includes("--receipt")
  ? JSON.parse(readFileSync(new URL("../../../.qa/skill-improvements-20260927/appshot/cases.json", import.meta.url), "utf8")).cases
  : [
    { id: "enumeration_denied", argv: ["--list", "--json"] },
    { id: "enumeration_empty", argv: ["--list", "--json"] },
    { id: "enumeration_populated", argv: ["--list", "--json"] },
    { id: "unusual_app_name", argv: ["--app", 'Odd" & (display dialog "INJECTED") & "', "--out", "fixture.png"] },
    { id: "window_lookup_denied", argv: ["--app", "Test Window", "--out", "fixture.png"] },
    { id: "window_lookup_invalid", argv: ["--app", "Test Window", "--out", "fixture.png"] },
    { id: "named_capture_success", argv: ["--app", "Test Window", "--out", "fixture.png"] },
    { id: "screen_success", argv: ["--screen", "--out", "fixture.png"] },
    { id: "region_success", argv: ["--region", "--out", "fixture.png"] },
  ];
const baseline = fileURLToPath(new URL("../../../.qa/skill-improvements-20260927/baseline.json", import.meta.url));
const harness = String.raw`
import json, os, pathlib, runpy, subprocess, sys
case = os.environ["APPSHOT_CASE"]
calls = []
sameDir = []
real_exists = pathlib.Path.exists
pathlib.Path.exists = lambda self: True if str(self) == "/usr/sbin/screencapture" else real_exists(self)
def fake_run(argv, **kwargs):
    calls.append(["<OUT>" if x == os.environ["APPSHOT_OUT"] else ("<TMP>" if "appshot-capture-" in x else x) for x in argv])
    for x in argv:
        if "appshot-capture-" in x:
            sameDir.append(os.path.realpath(os.path.dirname(os.path.dirname(x))) == os.path.realpath(os.path.dirname(os.environ["APPSHOT_OUT"])))
    if argv[0] == "osascript":
        if "--list" in os.environ["APPSHOT_ARGS"]:
            if case == "enumeration_denied":
                return subprocess.CompletedProcess(argv, 1, "", "Not authorized to send Apple events. (-1743)")
            us = "\x1f"
            value = {
                "enumeration_populated": f"W{us}Test Window{us}1 window(s)",
                "enumeration_partial": f"W{us}Test Window{us}1 window(s)\x1eE{us}Locked App{us}Not authorized\n(-1743)",
                "enumeration_odd_name": f"W{us}!! Demo :: x{us}1 window(s)",
            }.get(case, "")
            return subprocess.CompletedProcess(argv, 0, value, "")
        if len([x for x in calls if x[0] == "osascript"]) == 1:
            if case == "activation_denied":
                return subprocess.CompletedProcess(argv, 1, "", "Not authorized to send Apple events to System Events. (-1743)")
            return subprocess.CompletedProcess(argv, 0, "", "")
        if case == "window_lookup_denied":
            return subprocess.CompletedProcess(argv, 1, "", "AXWindowNumber denied")
        value = "not-a-window" if case == "window_lookup_invalid" else "1234\n"
        return subprocess.CompletedProcess(argv, 0, value, "")
    if case in ("no_output", "stale_output"):
        return subprocess.CompletedProcess(argv, 0, "", "")
    pathlib.Path(argv[-1]).write_bytes(b"fixture")
    return subprocess.CompletedProcess(argv, 0, "", "")
subprocess.run = fake_run
sys.argv = ["appshot.py", *json.loads(os.environ["APPSHOT_ARGS"])]
try:
    if os.environ.get("APPSHOT_ARM") == "A":
        entries = json.loads(pathlib.Path(os.environ["APPSHOT_BASELINE"]).read_text())["entries"]
        body = next(x["body"] for x in entries if x["origin"] == "canonical" and x["skill"] == "appshot" and x["relative"] == "scripts/appshot.py")
        exec(compile(body, "frozen-appshot.py", "exec"), {"__name__": "__main__"})
    else:
        runpy.run_path(os.environ["APPSHOT_SCRIPT"], run_name="__main__")
except SystemExit as error:
    status = error.code
else:
    status = 0
print("__RECEIPT__" + json.dumps({"exit": status, "calls": calls, "sameDir": sameDir}), file=sys.stderr)
`;

function runCase(entry, arm = "B") {
  const root = mkdtempSync(join(tmpdir(), "appshot-test-"));
  try {
    const out = join(root, "fixture.png");
    const args = entry.argv.map((arg) => arg === "fixture.png" ? out : arg === "DIR" ? root : arg);
    if (entry.id === "stale_output") writeFileSync(out, "old capture");
    if (entry.id === "stale_output" && entry.argv.includes("-")) writeFileSync(join(root, "-"), "old capture");
    const run = spawnSync("python3", ["-B", "-c", harness], {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        APPSHOT_CASE: entry.id,
        APPSHOT_ARGS: JSON.stringify(args),
        APPSHOT_OUT: out,
        APPSHOT_ARM: arm,
        APPSHOT_BASELINE: baseline,
        APPSHOT_SCRIPT: script,
      },
    });
    assert.equal(run.error, undefined, String(run.error));
    const marker = run.stderr.lastIndexOf("__RECEIPT__");
    assert.notEqual(marker, -1, run.stderr);
    const receipt = JSON.parse(run.stderr.slice(marker + "__RECEIPT__".length));
    const published = existsSync(out) ? readFileSync(out, "utf8") : null;
    const dashLeftBehind = existsSync(join(root, "-")) && readFileSync(join(root, "-"), "utf8") !== "old capture";
    return {
      published,
      dashLeftBehind,
      exit: receipt.exit,
      stdout: run.stdout.replaceAll(out, "<OUT>"),
      stderr: run.stderr.slice(0, marker).trim(),
      calls: receipt.calls,
      sameDir: receipt.sameDir,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv.includes("--receipt")) {
  for (const entry of cases) {
    const arm = process.env.APPSHOT_ARM === "A" ? "A" : "B";
    console.log(JSON.stringify({ id: entry.id, arm, ...runCase(entry, arm) }));
  }
} else {
  test("denied enumeration reports an error instead of an empty list", () => {
    const result = runCase(cases[0]);
    assert.equal(result.exit, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Not authorized to send Apple events/);
  });

  test("genuine empty and populated enumeration retain their distinct results", () => {
    const empty = runCase(cases[1]);
    const populated = runCase(cases[2]);
    assert.equal(empty.exit, 1);
    assert.deepEqual(JSON.parse(empty.stdout), { windows: [] });
    assert.equal(empty.stderr, "");
    assert.equal(populated.exit, 0);
    assert.deepEqual(JSON.parse(populated.stdout), {
      windows: [{ app: "Test Window", info: "1 window(s)" }],
    });
  });

  test("unusual app names are argv data for both AppleScript calls", () => {
    const result = runCase(cases[3]);
    assert.equal(result.exit, 0, result.stderr);
    const name = cases[3].argv[1];
    const scripts = result.calls.filter(([cmd]) => cmd === "osascript");
    assert.equal(scripts.length, 2);
    for (const argv of scripts) {
      assert.equal(argv.at(-1), name);
      assert.equal(argv.slice(0, -1).join(" ").includes(name), false);
    }
    assert.match(scripts[0][2], /System Events.*frontmost of process/);
    assert.deepEqual(result.calls.at(-1), ["/usr/sbin/screencapture", "-l", "1234", "<TMP>"]);
  });

  test("failed and invalid named-window lookup never opens the picker", () => {
    for (const entry of cases.slice(4, 6)) {
      const result = runCase(entry);
      assert.equal(result.exit, 1, entry.id);
      assert.equal(result.calls.some(([cmd]) => cmd === "/usr/sbin/screencapture"), false, entry.id);
      assert.match(result.stderr, entry.id === "window_lookup_denied" ? /AXWindowNumber denied/ : /window ID/i);
    }
  });

  test("valid named capture and explicit screen or region keep native options", () => {
    const flags = [["-l", "1234"], ["-x"], ["-i"]];
    for (const [index, entry] of cases.slice(6).entries()) {
      const result = runCase(entry);
      assert.equal(result.exit, 0, `${entry.id}: ${result.stderr}`);
      // The native tool writes a private temp file; only a verified capture is published to --out.
      assert.deepEqual(result.calls.at(-1), ["/usr/sbin/screencapture", ...flags[index], "<TMP>"]);
      assert.match(result.stdout, /captured: <OUT> \(7 bytes\)/);
      assert.equal(result.published, "fixture");
    }
  });

  test("a capture that writes no new file is a failure, not a success", () => {
    for (const id of ["no_output", "stale_output"]) {
      // Given: screencapture exits 0 but writes nothing (with and without an older file at --out).
      const result = runCase({ id, argv: ["--screen", "--out", "fixture.png"] });
      // Then: no success receipt, and the old file is never reported as the new capture.
      assert.equal(result.exit, 1, id);
      assert.equal(result.stdout, "", id);
      assert.match(result.stderr, /no new capture/, id);
      // And an older file at --out is left exactly as it was.
      assert.equal(result.published, id === "stale_output" ? "old capture" : null, id);
    }
  });

  test("stdout mode streams a fresh private capture and leaves no ./- behind", () => {
    const result = runCase({ id: "region_success", argv: ["--region", "--out", "-"] });
    assert.equal(result.exit, 0, result.stderr);
    assert.equal(Buffer.from(result.stdout, "base64").toString(), "fixture");
    assert.deepEqual(result.calls.at(-1), ["/usr/sbin/screencapture", "-i", "<TMP>"]);
    assert.equal(result.dashLeftBehind, false);
  });

  test("a directory --out is refused before any capture", () => {
    const result = runCase({ id: "dir_out", argv: ["--screen", "--out", "DIR"] });
    assert.equal(result.exit, 2);
    assert.match(result.stderr, /directory/);
    assert.equal(result.calls.some(([cmd]) => cmd === "/usr/sbin/screencapture"), false);
  });

  test("the private capture sits beside --out, so publication is an atomic same-filesystem rename", () => {
    const result = runCase({ id: "screen_success", argv: ["--screen", "--out", "fixture.png"] });
    assert.equal(result.exit, 0, result.stderr);
    assert.deepEqual(result.sameDir, [true]);
  });

  test("--list combined with a capture mode or --out is a usage error", () => {
    for (const argv of [["--list", "--screen"], ["--list", "--out", "fixture.png"], ["--list", "--app", "X"]]) {
      const result = runCase({ id: "enumeration_populated", argv });
      assert.equal(result.exit, 2, argv.join(" "));
      assert.equal(result.calls.length, 0, argv.join(" "));
    }
  });

  test("explicit empty values still count as conflicting or missing arguments", () => {
    for (const argv of [["--list", "--app", ""], ["--list", "--out", ""], ["--app", "", "--out", "fixture.png"]]) {
      const result = runCase({ id: "enumeration_populated", argv });
      assert.equal(result.exit, 2, JSON.stringify(argv));
      assert.equal(result.calls.length, 0, JSON.stringify(argv));
    }
  });

  test("a missing capture mode is a usage error before any filesystem setup", () => {
    const result = runCase({ id: "screen_success", argv: ["--out", "missing-parent/shot.png"] });
    assert.equal(result.exit, 2);
    assert.match(result.stderr, /pass --screen, --app NAME, --region, or --list/);
  });

  test("conflicting capture modes are a usage error, not a silent choice", () => {
    const result = runCase({ id: "conflict", argv: ["--app", "NoSuchProcess", "--screen", "--out", "fixture.png"] });
    assert.equal(result.exit, 2);
    assert.equal(result.calls.length, 0);
  });

  test("an app name that looks like a protocol marker is still a window, not an error", () => {
    const result = runCase({ id: "enumeration_odd_name", argv: ["--list", "--json"] });
    assert.equal(result.exit, 0);
    assert.deepEqual(JSON.parse(result.stdout), { windows: [{ app: "!! Demo :: x", info: "1 window(s)" }] });
  });

  test("a symlinked --out stages beside the link itself, not beside its target", () => {
    const base = mkdtempSync(join(tmpdir(), "appshot-link-"));
    const other = mkdtempSync(join(tmpdir(), "appshot-target-"));
    try {
      writeFileSync(join(other, "target.png"), "old");
      const link = join(base, "link.png");
      symlinkSync(join(other, "target.png"), link);
      const probe = spawnSync("python3", ["-B", "-c", String.raw`
import json, os, pathlib, runpy, subprocess, sys, tempfile
seen = []
real_td = tempfile.TemporaryDirectory
def spy(*args, **kwargs):
    seen.append(kwargs.get("dir"))
    return real_td(*args, **kwargs)
tempfile.TemporaryDirectory = spy
real_exists = pathlib.Path.exists
pathlib.Path.exists = lambda self: True if str(self) == "/usr/sbin/screencapture" else real_exists(self)
def fake_run(argv, **kwargs):
    pathlib.Path(argv[-1]).write_bytes(b"fresh")
    return subprocess.CompletedProcess(argv, 0, "", "")
subprocess.run = fake_run
sys.argv = ["appshot.py", "--screen", "--out", sys.argv[2]]
try:
    runpy.run_path(sys.argv[0] if False else os.environ["APPSHOT_SCRIPT"], run_name="__main__")
except SystemExit as error:
    code = error.code
print(json.dumps({"code": code, "dirs": seen}))
`, "unused", link], { encoding: "utf8", env: { ...process.env, APPSHOT_SCRIPT: script } });
      const result = JSON.parse(probe.stdout.trim().split("\n").at(-1));
      assert.equal(result.code, 0, probe.stderr);
      assert.equal(realpathSync(result.dirs[0]), realpathSync(base));
    } finally {
      rmSync(other, { recursive: true, force: true });
      rmSync(base, { recursive: true, force: true });
    }
  });

  test("the real enumeration script turns a per-process failure into an E record (native, no app)", { skip: process.platform !== "darwin" }, () => {
    // Capture the exact AppleScript the helper sends, then run its per-process try block with a forced failure.
    const probe = spawnSync("python3", ["-B", "-c", String.raw`
import json, os, runpy, subprocess, sys
real = subprocess.run
captured = []
def capture(argv, **kwargs):
    captured.append(argv[2])
    return subprocess.CompletedProcess(argv, 0, "", "")
subprocess.run = capture
sys.argv = ["appshot.py", "--list", "--json"]
import pathlib
real_exists = pathlib.Path.exists
pathlib.Path.exists = lambda self: True if str(self) == "/usr/sbin/screencapture" else real_exists(self)
try:
    runpy.run_path(os.environ["APPSHOT_SCRIPT"], run_name="__main__")
except SystemExit:
    pass
script = captured[0]
block = script[script.index("  try"):script.index("  end try") + len("  end try")]
block = block.replace("set winCount to count of windows of p", 'error "boom"')
body = "\n".join(["set sep to (ASCII character 31)", "set winList to {}", 'set appName to "Probe App"', block, "return winList as string"])
result = real(["osascript", "-e", body], capture_output=True, text=True)
print(json.dumps({"code": result.returncode, "out": result.stdout.strip(), "err": result.stderr.strip()}))
`], { encoding: "utf8", env: { ...process.env, APPSHOT_SCRIPT: script } });
    const result = JSON.parse(probe.stdout.trim().split("\n").at(-1));
    assert.equal(result.code, 0, result.err);
    assert.equal(result.out, "E\u001fProbe App\u001fboom");
  });

  test("a per-process enumeration error is reported as skipped, not hidden", () => {
    const result = runCase({ id: "enumeration_partial", argv: ["--list", "--json"] });
    assert.equal(result.exit, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      windows: [{ app: "Test Window", info: "1 window(s)" }],
      // Records are framed by the ASCII record separator, so a multi-line error stays one record.
      skipped: [{ app: "Locked App", error: "Not authorized\n(-1743)" }],
    });
  });

  test("stdout mode (--out -) never emits a stale file as the capture", () => {
    // Given: an old file literally named "-" and a capture that writes nothing.
    const result = runCase({ id: "stale_output", argv: ["--region", "--out", "-"] });
    // Then: failure, and none of the old bytes reach stdout.
    assert.equal(result.exit, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /no new capture/);
  });

  test("an activation failure reports the activation error, not a missing app", () => {
    const result = runCase({ id: "activation_denied", argv: ["--app", "Test Window", "--out", "fixture.png"] });
    assert.equal(result.exit, 1);
    assert.match(result.stderr, /activation failed for Test Window: Not authorized/);
    assert.doesNotMatch(result.stderr, /app not found/);
    assert.equal(result.calls.some(([cmd]) => cmd === "/usr/sbin/screencapture"), false);
  });
}
