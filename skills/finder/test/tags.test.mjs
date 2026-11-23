import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const run = promisify(execFile);
const helper = fileURLToPath(new URL("../scripts/finder.py", import.meta.url));
const probe = `
import contextlib, importlib.util, io, json, plistlib, subprocess, sys
from enum import StrEnum
from typing import assert_never
from unittest.mock import patch
class Scenario(StrEnum):
    PRESENT = "present"
    ABSENT = "absent"
    DENIED = "denied"
    READ_DENIED = "read-denied"
    CORRUPT = "corrupt"
    TRASH = "trash"
    TRASH_EMPTY = "trash-empty"
    TRASH_SYMLINK = "trash-symlink"
spec = importlib.util.spec_from_file_location("finder_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
case, target = sys.argv[2:]
scenario = Scenario(case)
payload = plistlib.dumps(["alpha\\n6", "beta\\n0"])
command = subprocess.CompletedProcess([], 0, payload.hex(), "")
listing = subprocess.CompletedProcess([], 0, module.ATTR + "\\n", "")
match scenario:
    case Scenario.ABSENT:
        command = subprocess.CompletedProcess([], 1, "", "xattr: No such xattr")
        listing = subprocess.CompletedProcess([], 0, "", "")
    case Scenario.DENIED:
        command = subprocess.CompletedProcess([], 1, "", "xattr: Permission denied")
        listing = command
    case Scenario.READ_DENIED:
        command = subprocess.CompletedProcess([], 1, "", "xattr: Permission denied")
    case Scenario.CORRUPT:
        payload = b"not a property list"
        command = subprocess.CompletedProcess([], 0, payload.hex(), "")
    case Scenario.PRESENT | Scenario.TRASH | Scenario.TRASH_EMPTY | Scenario.TRASH_SYMLINK:
        command = subprocess.CompletedProcess([], 0, payload.hex(), "")
    case unexpected:
        assert_never(unexpected)
output = io.StringIO()
args = ["--json", "trash", "", "--yes"] if case == "trash-empty" else ["--json", "trash" if case == "trash" else "tags", target]
def attribute_command(args, **options):
    assert args[0] == "/usr/bin/xattr"
    return command if "-px" in args else listing
with patch.object(subprocess, "run", side_effect=attribute_command), \\
     patch.object(module, "run_script", side_effect=AssertionError("Unexpected Finder action")), \\
     contextlib.redirect_stdout(output):
    code = module.main(args)
print(json.dumps({"exit": code, "result": json.loads(output.getvalue())}))
`;

async function outcome(t, scenario) {
  const dir = await mkdtemp(join(tmpdir(), "finder-tags-test-"));
  t.after(() => rm(dir, { recursive: true }));
  const target = join(dir, "fixture.txt");
  await writeFile(target, "Task-owned fixture");
  const { stdout } = await run("python3", ["-B", "-c", probe, helper, scenario, target], { timeout: 10_000 });
  return JSON.parse(stdout);
}

test("tag reads preserve names from valid Finder metadata", async (t) => {
  // Given/When: the real CLI reads known metadata at the OS boundary.
  const result = await outcome(t, "present");
  // Then: color suffixes are removed, not the tag names.
  assert.equal(result.exit, 0);
  assert.deepEqual(result.result.tags, ["alpha", "beta"]);
});

test("an absent tag attribute is a successful empty result", async (t) => {
  const result = await outcome(t, "absent");
  assert.equal(result.exit, 0);
  assert.deepEqual(result.result.tags, []);
});

test("a denied tag read is not a successful empty tag list", async (t) => {
  const result = await outcome(t, "denied");
  assert.equal(result.exit, 1);
  assert.equal(typeof result.result.error, "string");
  assert.equal("tags" in result.result, false);
});

test("a failed value read after listing is not an empty tag list", async (t) => {
  const result = await outcome(t, "read-denied");
  assert.equal(result.exit, 1);
  assert.equal(typeof result.result.error, "string");
  assert.equal("tags" in result.result, false);
});

test("corrupt tag metadata remains an explicit failure", async (t) => {
  const result = await outcome(t, "corrupt");
  assert.equal(result.exit, 1);
  assert.equal(typeof result.result.error, "string");
});

test("an unconfirmed Trash request does not reach Finder", async (t) => {
  const result = await outcome(t, "trash");
  assert.equal(result.exit, 2);
  assert.equal(typeof result.result.error, "string");
});

test("an empty Trash target is rejected instead of resolving to the current directory", async (t) => {
  // Given/When: a confirmed Trash request whose path argument is empty, e.g. an unset shell variable.
  const result = await outcome(t, "trash-empty");
  // Then: it is a usage error and Finder is never asked to delete anything.
  assert.equal(result.exit, 2);
  assert.equal(typeof result.result.error, "string");
});

test("trashing a symlink moves the link itself through NSFileManager, never Finder's alias", async (t) => {
  // Given: a disposable file and a symlink to it.
  const dir = await mkdtemp(join(tmpdir(), "finder-symlink-test-"));
  t.after(() => rm(dir, { recursive: true }));
  const target = join(dir, "target.txt");
  const link = join(dir, "link.txt");
  await writeFile(target, "target");
  await symlink(target, link);
  // When: the real CLI trashes the link and then the regular file, with the script runner replaced by a recorder.
  const recorder = String.raw`
import contextlib, importlib.util, io, json, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("finder_probe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
seen = []
def record(body, *args):
    seen.append({"args": list(args), "nsfilemanager": "trashItemAtURL" in body, "finder_delete": 'tell application "Finder" to delete' in body})
    return []
out = []
for operand in sys.argv[2:]:
    seen.clear()
    with patch.object(module, "run_script", side_effect=record), contextlib.redirect_stdout(io.StringIO()):
        code = module.main(["--json", "trash", operand, "--yes"])
    out.append({"exit": code, "seen": list(seen)})
print(json.dumps(out))
`;
  const { stdout } = await run("python3", ["-B", "-c", recorder, helper, link, target], { timeout: 10_000 });
  const [linked, regular] = JSON.parse(stdout);
  // Then: the link path goes to NSFileManager; Finder's alias coercion would follow it to the target.
  assert.equal(linked.exit, 0);
  assert.equal(linked.seen.length, 1);
  assert.equal(linked.seen[0].args[0].endsWith("link.txt"), true, JSON.stringify(linked.seen));
  assert.equal(linked.seen[0].nsfilemanager, true);
  assert.equal(linked.seen[0].finder_delete, false);
  // And: a regular file keeps the Finder path.
  assert.equal(regular.exit, 0);
  assert.equal(regular.seen[0].finder_delete, true);
  assert.equal(regular.seen[0].nsfilemanager, false);
});
