import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("bundled helper CLIs execute through file and directory symlinks", (t) => {
  const root = mkdtempSync(join(tmpdir(), "skill-entrypoints-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cases = [
    ["../../notion/scripts/read.mjs", ["--query", "fixture"], 1, "no_credential"],
    ["../../obsidian-vault/scripts/inventory.mjs", ["--app", join(root, "missing")], 0, "app_absent"],
    ["../scripts/plan.mjs", [], 2, "invalid-input"],
  ];
  for (const [relative, args, code, status] of cases) {
    const real = fileURLToPath(new URL(relative, import.meta.url));
    for (const kind of ["file", "directory"]) {
      const link = join(root, `${status}-${kind}`);
      symlinkSync(kind === "file" ? real : dirname(real), link);
      const script = kind === "file" ? link : join(link, real.split("/").at(-1));
      const env = { ...process.env };
      delete env.NOTION_API_KEY;
      const run = spawnSync(process.execPath, [script, ...args], { env, encoding: "utf8", timeout: 5000 });
      assert.equal(run.status, code, `${relative}: ${run.stderr}`);
      assert.equal(JSON.parse(run.stdout || run.stderr).status, status);
    }
  }
});
