import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { inventory } from "../scripts/inventory.mjs";
import { excerpt } from "../scripts/excerpt.mjs";

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "obsidian-gate-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const app = join(root, "Obsidian.app");
  const vault = join(root, "vault");
  mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
  writeFileSync(join(app, "Contents", "MacOS", "Obsidian"), "fixture executable", { mode: 0o755 });
  mkdirSync(vault);
  return { root, app, vault };
}

test("app absence blocks even an explicitly named nonempty vault", async (t) => {
  // Given: an accessible note but no app installation.
  const box = fixture(t);
  writeFileSync(join(box.vault, "note.md"), "A real note");

  // When: inventory runs against an absent app.
  const result = await inventory({ app: join(box.root, "missing.app"), vault: box.vault });

  // Then: note metadata is not surfaced.
  assert.equal(result.status, "app_absent");
  assert.deepEqual(result.notes, []);
});

test("an arbitrary directory is not an installed Obsidian application", async (t) => {
  const box = fixture(t);
  const notAnApp = join(box.root, "ordinary-directory");
  mkdirSync(notAnApp);
  writeFileSync(join(box.vault, "note.md"), "A real note");
  const result = await inventory({ app: notAnApp, vault: box.vault });
  assert.equal(result.status, "app_absent");
  assert.deepEqual(result.notes, []);
});

test("missing vault configuration and empty vault cannot grant knowledge access", async (t) => {
  const box = fixture(t);
  writeFileSync(join(box.vault, "blank.md"), "");
  assert.equal((await inventory({ app: box.app })).status, "vault_unconfigured");
  assert.equal((await inventory({ app: box.app, vault: box.vault })).status, "vault_empty");
});

test("nonempty note is a bounded metadata candidate, not a text excerpt", async (t) => {
  // Given: a configured root containing a real Markdown note and an irrelevant file.
  const box = fixture(t);
  mkdirSync(join(box.vault, "Projects"));
  writeFileSync(join(box.vault, "Projects", "decision.md"), "Choose the portable format");
  writeFileSync(join(box.vault, "token.txt"), "not a note");

  // When: the inventory checks filesystem metadata.
  const result = await inventory({ app: box.app, vault: box.vault });

  // Then: only one relative path and metadata appear, never note text.
  assert.equal(result.status, "candidates");
  assert.deepEqual(result.notes.map(({ path }) => path), ["Projects/decision.md"]);
  assert.equal(result.notes[0].bytes, 26);
  assert.equal(JSON.stringify(result).includes("portable format"), false);
  assert.equal(result.incomplete, false);
});

test("the installed helper CLI emits machine-readable candidate metadata", (t) => {
  // Given: a fake installation and a single explicit vault with one note.
  const box = fixture(t);
  writeFileSync(join(box.vault, "named.md"), "fixture content");

  // When: the public CLI is invoked as a separate Node process.
  const run = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/inventory.mjs", import.meta.url)),
    "--app", box.app, "--vault", box.vault], { encoding: "utf8", timeout: 5_000 });

  // Then: exit status and JSON identify a candidate, without copying note text.
  assert.equal(run.status, 0);
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, "candidates");
  assert.deepEqual(result.notes.map(({ path }) => path), ["named.md"]);
  assert.equal(run.stdout.includes("fixture content"), false);
});

test("inaccessible, relative, and symlink-root vault paths fail closed", async (t) => {
  const box = fixture(t);
  const linked = join(box.root, "alias");
  symlinkSync(box.vault, linked, "dir");
  assert.equal((await inventory({ app: box.app, vault: join(box.root, "missing") })).status, "vault_inaccessible");
  chmodSync(box.vault, 0);
  assert.equal((await inventory({ app: box.app, vault: box.vault })).status, "vault_inaccessible");
  chmodSync(box.vault, 0o700);
  assert.equal((await inventory({ app: box.app, vault: linked })).status, "path_unsafe");
  const parentLink = join(box.root, "parent-alias");
  symlinkSync(box.root, parentLink, "dir");
  assert.equal((await inventory({ app: box.app, vault: join(parentLink, "vault") })).status, "path_unsafe");
  assert.equal((await inventory({ app: box.app, vault: "relative/path" })).status, "invalid_input");
});

test("symlinked notes and directories cannot escape the selected vault", async (t) => {
  // Given: a real note and two links to content outside the vault.
  const box = fixture(t);
  const outside = join(box.root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "secret.md"), "not in this vault");
  writeFileSync(join(box.vault, "safe.md"), "local");
  symlinkSync(join(outside, "secret.md"), join(box.vault, "escape.md"));
  symlinkSync(outside, join(box.vault, "shortcut"), "dir");

  // When: inventory scans the vault.
  const result = await inventory({ app: box.app, vault: box.vault });

  // Then: neither link is followed.
  assert.equal(result.status, "candidates");
  assert.deepEqual(result.notes.map(({ path }) => path), ["safe.md"]);
  assert.equal(result.skippedSymlinks, 2);
});

test("bounded enumeration reports uncertainty rather than an empty vault", async (t) => {
  const box = fixture(t);
  for (let i = 0; i < 260; i++) writeFileSync(join(box.vault, `${i}.txt`), "x");
  const result = await inventory({ app: box.app, vault: box.vault });
  assert.equal(result.status, "inventory_limited");
  assert.equal(result.scannedEntries, 256);
  assert.deepEqual(result.notes, []);
});

test("selected excerpts reject external symlinks and never read beyond the byte budget", async (t) => {
  const box = fixture(t);
  writeFileSync(join(box.vault, "large.md"), "a".repeat(8192) + "PRIVATE_TAIL".repeat(100000));
  const out = await excerpt({ app: box.app, vault: box.vault, path: "large.md" });
  assert.equal(out.status, "ready");
  assert.equal(out.bytesRead, 8192);
  assert.equal(out.excerpt, "a".repeat(8192));
  assert.equal(out.incomplete, true);
  const outside = join(box.root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "secret.md"), "external");
  symlinkSync(outside, join(box.vault, "Shared"));
  assert.equal((await excerpt({ app: box.app, vault: box.vault, path: "Shared/secret.md" })).status, "path_unsafe");
  assert.equal((await excerpt({ app: box.app, vault: box.vault, path: "../outside/secret.md" })).status, "path_unsafe");
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/excerpt.mjs", import.meta.url)),
    "--app", box.app, "--vault", box.vault, "--path", "large.md"], { encoding: "utf8", timeout: 5000 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).bytesRead, 8192);
  assert.equal(cli.stdout.includes("PRIVATE_TAIL"), false);
});
