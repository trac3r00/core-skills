#!/usr/bin/env node
import { lstat, open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inventory } from "./inventory.mjs";

export async function excerpt({ app, vault, path, offset = 0 } = {}) {
  const result = (status, fields = {}) => ({ status, checkedAt: new Date().toISOString(), ...fields });
  if (typeof path !== "string" || isAbsolute(path) || !/\.md$/i.test(path)
    || !Number.isSafeInteger(offset) || offset < 0) return result("invalid_input");
  const gate = await inventory({ app, vault });
  if (!["candidates", "vault_empty", "inventory_limited"].includes(gate.status)) return gate;
  const root = resolve(vault);
  const file = resolve(root, path);
  if (!file.startsWith(root + sep)) return result("path_unsafe");
  try {
    if (await realpath(root) !== root || await realpath(file) !== file) return result("path_unsafe");
    if (!(await lstat(file)).isFile()) return result("path_unsafe");
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await handle.stat();
      if (!info.isFile()) return result("path_unsafe");
      const buffer = Buffer.alloc(8192);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead), { stream: true });
      return result(text.trim() ? "ready" : "no_content", {
        vault: root, path: relative(root, file).split(sep).join("/"), offset, bytesRead, modifiedAt: info.mtime.toISOString(),
        excerpt: text, incomplete: offset > 0 || offset + bytesRead < info.size,
      });
    } finally {
      await handle.close();
    }
  } catch (error) {
    return result(["ELOOP", "ENOTDIR"].includes(error.code) ? "path_unsafe" : "unreadable");
  }
}

const invokedPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (invokedPath === await realpath(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const options = {};
  let invalid = false;
  for (let i = 0; i < args.length; i += 2) {
    const key = ({ "--app": "app", "--vault": "vault", "--path": "path", "--offset": "offset" })[args[i]];
    if (!key || !args[i + 1]) { invalid = true; break; }
    options[key] = key === "offset" ? Number(args[i + 1]) : args[i + 1];
  }
  try {
    const out = invalid ? { status: "invalid_input" } : await excerpt(options);
    console.log(JSON.stringify(out));
    process.exitCode = out.status === "invalid_input" ? 2 : ["ready", "no_content"].includes(out.status) ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ status: "unreadable" }));
    process.exitCode = 1;
  }
}
