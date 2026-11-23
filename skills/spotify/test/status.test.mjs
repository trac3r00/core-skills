import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const run = promisify(execFile);
const helper = process.env.SPOTIFY_HELPER ?? fileURLToPath(new URL("../scripts/spotify.py", import.meta.url));
const dictionaryFixture = fileURLToPath(new URL("./fixtures/SpotifyCompileFixture.app", import.meta.url));

// Drives the real CLI and status parser; only the AppleScript boundary returns a controlled payload.
const probe = String.raw`
import base64, contextlib, importlib.util, io, json, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
b = lambda text: base64.b64encode(text.encode()).decode()
payloads = {
    "track": "\t".join([b("paused"), b("The Scientist"), b("Coldplay"), b("A Rush of Blood"), "310000", "153.5", b("spotify:track:x"), "73", "true", "false"]),
    "no-track": "\t".join([b("paused"), "", "", "", "", "", "", "73", "false", "false"]),
    "not-running": b("not running"),
    "comma-locale": "\t".join([b("paused"), b("Song"), b("Artist"), b("Album"), "310000", "153,5", b("spotify:track:x"), "73", "true", "false"]),
}
output = io.StringIO()
with patch.object(module, "run_script", return_value=[payloads[sys.argv[2]]]), contextlib.redirect_stdout(output):
    code = module.main(["--json", "status"])
print(json.dumps({"exit": code, "result": json.loads(output.getvalue())}))
`;

async function status(state) {
  const { stdout } = await run("python3", ["-B", "-c", probe, helper, state], { timeout: 10_000 });
  return JSON.parse(stdout);
}

test("a loaded track reports its populated fields", async () => {
  const { exit, result } = await status("track");
  assert.equal(exit, 0);
  assert.equal(result.player_state, "paused");
  assert.equal(result.track_name, "The Scientist");
  assert.equal(result.duration_ms, 310000);
  assert.equal(result.volume, 73);
  assert.equal(result.shuffle, true);
});

test("running with no current track reports null track fields, not an error", async () => {
  const { exit, result } = await status("no-track");
  assert.equal(exit, 0);
  assert.equal(result.player_state, "paused");
  for (const field of ["track_name", "artist", "album", "duration_ms", "position_seconds", "spotify_url"]) {
    assert.equal(result[field], null, field);
  }
  assert.equal(result.volume, 73);
});

test("a stopped app is reported as not running without player fields", async () => {
  const { exit, result } = await status("not-running");
  assert.equal(exit, 0);
  assert.equal(result.player_state, "not running");
  assert.equal(result.track_name, null);
  assert.equal(result.volume, null);
});

test("a comma-decimal locale still yields a numeric position", async () => {
  // Given: AppleScript coerces real numbers with the system's comma decimal separator.
  const { exit, result } = await status("comma-locale");
  // Then: the position parses instead of failing the whole status read.
  assert.equal(exit, 0);
  assert.equal(result.position_seconds, 153.5);
  assert.equal(result.duration_ms, 310000);
});

// Runs the rendered no-track handler from STATUS_BODY through osascript (no Spotify involved).
const handlerProbe = String.raw`
import importlib.util, subprocess, sys
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
body = module.STATUS_BODY
start = body.index("on error errorMessage")
handler = body[start:body.index("end try", start)]
script = "\n".join([
    'set trackName to ""', 'set artistName to ""', 'set albumName to ""',
    'set trackDuration to ""', 'set trackPosition to ""', 'set trackUrl to ""',
    "try", 'set trackName to "partial"', "error \"boom\" number " + sys.argv[2], handler + "end try",
    'return "name=" & trackName',
])
result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
print(result.returncode, result.stdout.strip() or result.stderr.strip())
`;

async function handler(errorNumber) {
  const { stdout } = await run("python3", ["-B", "-c", handlerProbe, helper, String(errorNumber)], { timeout: 10_000 });
  const [code, ...rest] = stdout.trim().split(" ");
  return { code: Number(code), text: rest.join(" ") };
}

test("the no-track handler compiles, clears partial fields, and swallows only missing-track errors", { skip: process.platform !== "darwin" }, async () => {
  for (const missing of [-1728, -1700]) {
    // Given: a track field was read before the current track vanished.
    const result = await handler(missing);
    // Then: no error, and no stale metadata survives.
    assert.equal(result.code, 0, `${missing}: ${result.text}`);
    assert.equal(result.text, "name=", String(missing));
  }
  const denied = await handler(-1743);
  assert.notEqual(denied.code, 0, "an automation denial must re-raise");
  assert.match(denied.text, /-1743/);
});

test("--json after -- stays a literal search query", async () => {
  const { stdout } = await run("python3", ["-B", "-c", String.raw`
import importlib.util, json, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
seen = []
with patch.object(module, "mutation", side_effect=lambda name, script, *values, **options: seen.append(values) or {"ok": True}):
    module.main(["open-search", "--", "--json"])
print(json.dumps(seen))
`, helper], { timeout: 10_000 });
  assert.deepEqual(JSON.parse(stdout.trim().split("\n").at(-1)), [["spotify:search:--json"]]);
});


test("volume compensates a one-step-short readback with a second set, then reports exact", async () => {
  const { stdout } = await run("python3", ["-B", "-c", String.raw`
import base64, contextlib, importlib.util, io, json, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
b = lambda text: base64.b64encode(text.encode()).decode()
state = {"volume": 73}
sets = []
def fake(body, *args):
    if "set answerText to \"done\"" in body:
        requested = int(args[0])
        sets.append(requested)
        state["volume"] = requested - 1 if requested in (50, 51) else requested  # as measured: set 50 reads 49, set 51 reads 50
        return ["done"]
    return ["\t".join([b("paused"), "", "", "", "", "", "", str(state["volume"]), "false", "false"])]
out = io.StringIO()
with patch.object(module, "run_script", side_effect=fake), contextlib.redirect_stdout(out):
    code = module.main(["--json", "volume", "50"])
print(json.dumps({"code": code, "sets": sets, "result": json.loads(out.getvalue())}))
`, helper], { timeout: 10_000 });
  const probe = JSON.parse(stdout);
  assert.equal(probe.code, 0);
  assert.deepEqual(probe.sets, [50, 51]);
  assert.equal(probe.result.status.volume, 50);
  assert.equal(probe.result.requested, 50);
  assert.equal(probe.result.exact, true);
});

test("a volume readback that differs from the request is a failure that names the actual value", async () => {
  const { stdout } = await run("python3", ["-B", "-c", String.raw`
import base64, contextlib, importlib.util, io, json, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
b = lambda text: base64.b64encode(text.encode()).decode()
fake = lambda body, *args: ["done"] if "set answerText to \"done\"" in body else ["\t".join([b("paused"), "", "", "", "", "", "", "100", "false", "false"])]
out = io.StringIO()
with patch.object(module, "run_script", side_effect=fake), contextlib.redirect_stdout(out):
    code = module.main(["--json", "volume", "99"])
print(json.dumps({"code": code, "out": json.loads(out.getvalue())}))
`, helper], { timeout: 10_000 });
  const { code, out } = JSON.parse(stdout);
  assert.equal(code, 1);
  assert.match(out.error, /reads 100 after requesting 99/);
});

const raceProbe = String.raw`
import base64, contextlib, importlib.util, io, json, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
b = lambda text: base64.b64encode(text.encode()).decode()
changes = int(sys.argv[2])
calls = []
def fake(body, *args):
    calls.append(1)
    if len(calls) <= changes:
        raise module.SkillError("track changed while reading (9901)")
    return ["\t".join([b("playing"), b("Song"), b("Artist"), b("Album"), "1000", "1.0", b("spotify:track:x"), "40", "false", "false"])]
out = io.StringIO()
with patch.object(module, "run_script", side_effect=fake), contextlib.redirect_stdout(out):
    code = module.main(["--json", "status"])
print(json.dumps({"code": code, "calls": len(calls), "out": json.loads(out.getvalue())}))
`;

test("a track change during a status read is retried once, never mixed into one result", async () => {
  const once = JSON.parse((await run("python3", ["-B", "-c", raceProbe, helper, "1"], { timeout: 10_000 })).stdout);
  assert.equal(once.code, 0);
  assert.equal(once.calls, 2);
  assert.equal(once.out.track_name, "Song");
  const twice = JSON.parse((await run("python3", ["-B", "-c", raceProbe, helper, "2"], { timeout: 10_000 })).stdout);
  assert.equal(twice.code, 1);
  assert.match(twice.out.error, /track changed/);
});

test("the full status script, including the track-change guard, compiles", { skip: process.platform !== "darwin" }, async () => {
  const { stdout } = await run("python3", ["-B", "-c", String.raw`
import importlib.util, json, os, subprocess, sys, tempfile
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
seen = []
real = subprocess.run
def capture(argv, **kwargs):
    seen.append(argv[2])
    return subprocess.CompletedProcess(argv, 0, "OK\n", "")
with patch.object(module.subprocess, "run", side_effect=capture):
    module.run_script(module.STATUS_BODY)
target = os.path.join(tempfile.mkdtemp(), "status.scpt")
# Redirect only app lookup; compile the complete shipped script against the fixture's terminology.
script = seen[0].replace('application "Spotify"', "application " + json.dumps(sys.argv[2]))
result = real(["osacompile", "-o", target, "-e", script], capture_output=True, text=True)
print(result.returncode, "9901" in seen[0], result.stderr.strip())
`, helper, dictionaryFixture], { timeout: 20_000 });
  const [code, guarded] = stdout.trim().split(" ");
  assert.equal(code, "0", stdout);
  assert.equal(guarded, "True");
});

test("the dictionary fixture does not hide invalid status syntax", { skip: process.platform !== "darwin" }, async () => {
  const { stdout } = await run("python3", ["-B", "-c", String.raw`
import json, os, subprocess, sys, tempfile
script = "tell application " + json.dumps(sys.argv[1]) + '\nset stateValue to player state as text\nset broken to (\nend tell'
result = subprocess.run(["osacompile", "-o", os.path.join(tempfile.mkdtemp(), "invalid.scpt"), "-e", script], capture_output=True, text=True)
print(result.returncode)
`, dictionaryFixture], { timeout: 20_000 });
  assert.notEqual(stdout.trim(), "0");
});

// Runs the real rendered status script natively with Spotify's properties replaced by controlled getters, so
// track transitions happen at exact points. No application is referenced.
const scenarioProbe = String.raw`
import base64, importlib.util, json, subprocess, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
urls, states = json.loads(sys.argv[2]), json.loads(sys.argv[3])
seen = []
real = subprocess.run
with patch.object(module.subprocess, "run", side_effect=lambda argv, **kw: seen.append(argv[2]) or subprocess.CompletedProcess(argv, 0, "OK\n", "")):
    module.run_script(module.STATUS_BODY)
script = seen[0]
swaps = {
    'if application "Spotify" is not running then': "if false then",
    'tell application "Spotify"\n': "",
    "end tell\nend if": "end if",
    "player state as text": "my getState()",
    "spotify url of current track as text": "my getUrl()",
    "name of current track as text": '"Song " & my current()',
    "artist of current track as text": '"Artist"',
    "album of current track as text": '"Album"',
    "duration of current track as text": '"1000"',
    "player position as text": '"1.0"',
    "sound volume as text": '"50"',
    "shuffling as text": '"false"',
    "repeating as text": '"false"',
}
for old, new in swaps.items():
    assert old in script, old
    script = script.replace(old, new)
prelude = "\n".join([
    "property urlSeq : " + "{" + ", ".join(json.dumps(u) for u in urls) + "}",
    "property stateSeq : " + "{" + ", ".join(json.dumps(s) for s in states) + "}",
    "property urlIdx : 0",
    "property stateIdx : 0",
    'property lastUrl : ""',
    "on getUrl()",
    "set urlIdx to urlIdx + 1",
    "set v to item (my clamp(urlIdx, count of urlSeq)) of urlSeq",
    'if v is "ABSENT" then error "no current track" number -1728',
    "set lastUrl to v",
    "return v",
    "end getUrl",
    "on getState()",
    "set stateIdx to stateIdx + 1",
    "return item (my clamp(stateIdx, count of stateSeq)) of stateSeq",
    "end getState",
    "on current()",
    "return lastUrl",
    "end current",
    "on clamp(i, n)",
    "if i > n then return n",
    "return i",
    "end clamp",
])
head, _, rest = script.partition("on b64(value)")
script = head + prelude + "\non b64(value)" + rest
out = real(["osascript", "-e", script], capture_output=True, text=True)
lines = out.stdout.rstrip("\n").split("\n")
if lines[0] == "OK":
    f = lines[1].split("\t")
    text = lambda v: base64.b64decode(v).decode()
    print(json.dumps({"ok": True, "state": text(f[0]), "name": text(f[1]), "url": text(f[6])}))
else:
    print(json.dumps({"ok": False, "error": base64.b64decode(lines[1]).decode() if len(lines) > 1 else out.stderr}))
`;

async function scenario(urls, states) {
  const { stdout } = await run("python3", ["-B", "-c", scenarioProbe, helper, JSON.stringify(urls), JSON.stringify(states)], { timeout: 20_000 });
  return JSON.parse(stdout.trim().split("\n").at(-1));
}

test("status never combines state and metadata from different track snapshots (native, controlled getters)", { skip: process.platform !== "darwin" }, async () => {
  // A steady track: state and metadata agree.
  assert.deepEqual(await scenario(["spotify:track:B"], ["playing"]), { ok: true, state: "playing", name: "Song spotify:track:B", url: "spotify:track:B" });
  // Paused A switches to playing B before the first URL read: the guarded state belongs to B.
  assert.deepEqual(await scenario(["spotify:track:B"], ["paused", "playing"]), { ok: true, state: "playing", name: "Song spotify:track:B", url: "spotify:track:B" });
  // The track disappears before the first URL read: the state is re-sampled after the handler.
  assert.deepEqual(await scenario(["ABSENT"], ["playing", "stopped"]), { ok: true, state: "stopped", name: "", url: "" });
  // Absent, then B appears before the post-handler state read: churn, never a mixed success.
  const churn = await scenario(["ABSENT", "spotify:track:B"], ["stopped", "playing"]);
  assert.equal(churn.ok, false);
  assert.match(churn.error, /9901/);
  // Spotify IDs are case-sensitive: a change only in letter case is a different track.
  const caseOnly = await scenario(["spotify:track:aB", "spotify:track:Ab"], ["playing"]);
  assert.equal(caseOnly.ok, false);
  assert.match(caseOnly.error, /9901/);
});

test("non-playback commands never launch Spotify; only play, toggle and open may", { skip: process.platform !== "darwin" }, async () => {
  const { stdout } = await run("python3", ["-B", "-c", String.raw`
import importlib.util, json, subprocess, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("spotify_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
bodies = {}
def fake(body, *args):
    bodies.setdefault(current[0], body)
    raise module.SkillError("stop after capture")
current = [None]
commands = {"pause": ["pause"], "next": ["next"], "seek": ["seek", "1"], "volume": ["volume", "50"], "shuffle": ["shuffle", "on"], "repeat": ["repeat", "off"], "play": ["play"], "toggle": ["toggle"], "open": ["open", "spotify:track:x"]}
with patch.object(module, "run_script", side_effect=fake):
    for name, argv in commands.items():
        current[0] = name
        module.main(argv)
result = {}
for name, body in bodies.items():
    # Run only the guard, against an application that is certainly not running: it must refuse natively.
    guard = body.split("\n")[0].replace('"Spotify"', '"OmoNoSuchAppQA"')
    guarded = guard.startswith("if application")
    native = subprocess.run(["osascript", "-e", guard], capture_output=True, text=True) if guarded else None
    result[name] = {"guarded": guarded, "refuses": bool(native and native.returncode != 0 and "9902" in native.stderr)}
print(json.dumps(result))
`, helper], { timeout: 30_000 });
  const result = JSON.parse(stdout.trim().split("\n").at(-1));
  for (const name of ["pause", "next", "seek", "volume", "shuffle", "repeat"]) {
    assert.deepEqual(result[name], { guarded: true, refuses: true }, name);
  }
  for (const name of ["play", "toggle", "open"]) assert.equal(result[name].guarded, false, name);
});
