// OmO Pro Review - minimal zip writer (no dependencies, Node.js 24+).
// Writes a standard PKZIP archive (deflate or stored, no zip64) from in-memory
// entries. Timestamps are fixed, so the same files always give the same bytes and
// the same SHA-256: the hash recorded before upload can be compared with ChatGPT's
// stored copy afterwards.
import { crc32, deflateRawSync } from "node:zlib";

const DOS_TIME = 0; // 00:00:00
const DOS_DATE = (1 << 5) | 1; // 1980-01-01
const UTF8_NAMES = 1 << 11;

/** @param {{ path: string, bytes: Buffer }[]} entries repository-relative POSIX paths */
export function zipEntries(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const seen = new Set();
  for (const { path, bytes } of entries) {
    if (typeof path !== "string" || path === "" || path.startsWith("/") || path.split("/").includes("..") || path.includes("\\")) {
      throw new Error("pro-review zip: not a plain relative path: " + path);
    }
    if (seen.has(path)) throw new Error("pro-review zip: duplicate path: " + path);
    seen.add(path);
    const name = Buffer.from(path, "utf8");
    const deflated = deflateRawSync(bytes, { level: 9 });
    const stored = deflated.length >= bytes.length;
    const data = stored ? bytes : deflated;
    const crc = crc32(bytes) >>> 0;
    if (bytes.length > 0xfffffffe || offset > 0xfffffffe) throw new Error("pro-review zip: archive too large (no zip64)");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // made by: Unix, spec 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_NAMES, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  if (entries.length > 0xffff) throw new Error("pro-review zip: too many files (no zip64)");
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
