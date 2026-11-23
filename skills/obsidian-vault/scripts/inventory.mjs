#!/usr/bin/env node
// Read-only, metadata-only eligibility check. Node >=24; no network or packages.
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ENTRIES = 256;
const MAX_DIRS = 32;
const MAX_DEPTH = 3;
const MAX_NOTES = 12;

function report(status, extra = {}) {
  return { status, checkedAt: new Date().toISOString(), notes: [], ...extra };
}

async function installed(appPath) {
  const candidates = appPath ? [appPath] : process.platform === "darwin"
    ? ["/Applications/Obsidian.app", join(homedir(), "Applications/Obsidian.app")]
    : [];
  for (const candidate of candidates) {
    try {
      if (!(await lstat(candidate)).isDirectory()) continue;
      const binary = await lstat(join(candidate, "Contents", "MacOS", "Obsidian"));
      if (binary.isFile() && (binary.mode & 0o111)) return true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return false;
}

export async function inventory({ app, vault } = {}) {
  if (!(await installed(app))) return report("app_absent");
  if (!vault) return report("vault_unconfigured");
  if (!isAbsolute(vault)) return report("invalid_input");

  const root = resolve(vault);
  try {
    const info = await lstat(root);
    if (info.isSymbolicLink() || await realpath(root) !== root) return report("path_unsafe");
    if (!info.isDirectory() || !(info.mode & 0o444) || !(info.mode & 0o111)) return report("vault_inaccessible");
  } catch (error) {
    if (["ENOENT", "EACCES", "EPERM", "ENOTDIR"].includes(error.code)) return report("vault_inaccessible");
    throw error;
  }

  const notes = [];
  const queue = [{ path: root, depth: 0 }];
  let scannedEntries = 0;
  let scannedDirs = 0;
  let skippedSymlinks = 0;
  let incomplete = false;
  let inaccessible = false;
  while (queue.length && !incomplete && notes.length < MAX_NOTES) {
    if (scannedDirs === MAX_DIRS) { incomplete = true; break; }
    const { path, depth } = queue.shift();
    scannedDirs++;
    try {
      // A queued directory might have been replaced since its parent was visited.
      const current = await lstat(path);
      if (!current.isDirectory() || await realpath(path) !== path
        || (path !== root && !path.startsWith(`${root}${sep}`))) {
        inaccessible = true;
        continue;
      }
      for await (const entry of await opendir(path)) {
        if (scannedEntries === MAX_ENTRIES) { incomplete = true; break; }
        scannedEntries++;
        if (entry.name.startsWith(".")) continue;
        if (entry.isSymbolicLink()) { skippedSymlinks++; continue; }
        const full = join(path, entry.name);
        if (entry.isDirectory()) {
          if (depth < MAX_DEPTH) queue.push({ path: full, depth: depth + 1 });
          else incomplete = true;
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          try {
            const info = await lstat(full);
            if (!info.isFile() || !info.size || !(info.mode & 0o444)) continue;
            // O_NOFOLLOW also protects the interval between enumeration and opening.
            const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
            await handle.close();
            notes.push({ path: relative(root, full).split(sep).join("/"), bytes: info.size, modifiedAt: info.mtime.toISOString() });
            if (notes.length === MAX_NOTES) { incomplete = true; break; }
          } catch (error) {
            if (["ENOENT", "EACCES", "EPERM", "ELOOP"].includes(error.code)) { inaccessible = true; continue; }
            throw error;
          }
        }
      }
    } catch (error) {
      if (["ENOENT", "EACCES", "EPERM", "ENOTDIR"].includes(error.code)) { inaccessible = true; continue; }
      throw error;
    }
  }
  const detail = { vault: root, notes, scannedEntries, scannedDirs, skippedSymlinks, incomplete, inaccessible };
  if (notes.length) return report("candidates", detail);
  if (inaccessible) return report("vault_inaccessible", detail);
  return report(incomplete ? "inventory_limited" : "vault_empty", detail);
}

const invokedPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (invokedPath === await realpath(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  let app;
  let vault = process.env.OBSIDIAN_VAULT;
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === "--app" && args[i + 1]) app = args[i + 1];
    else if (args[i] === "--vault" && args[i + 1]) vault = args[i + 1];
    else { console.log(JSON.stringify(report("invalid_input"))); process.exit(2); }
  }
  try {
    const result = await inventory({ app, vault });
    console.log(JSON.stringify(result));
    process.exitCode = ["invalid_input"].includes(result.status) ? 2
      : ["vault_inaccessible", "path_unsafe", "inventory_limited"].includes(result.status) ? 1 : 0;
  } catch {
    console.log(JSON.stringify(report("io_error")));
    process.exitCode = 1;
  }
}
