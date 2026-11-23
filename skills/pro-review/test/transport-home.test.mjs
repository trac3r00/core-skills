import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { migrateTransportHome, transportHome } from "../scripts/pro-engine.mjs";

const dir = mkdtempSync(join(os.tmpdir(), "pro-review-home-"));
after(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;
const box = () => {
  const root = join(dir, String(n++));
  mkdirSync(root);
  return { home: join(root, ".pro-review"), legacy: join(root, ".oracle") };
};
const legacyProfile = (legacy) => {
  mkdirSync(join(legacy, "browser-profile"), { recursive: true });
  writeFileSync(join(legacy, "browser-profile", "Cookies"), "signed-in");
};

test("the new home is used, or the legacy one until it has moved", () => {
  const b = box();
  assert.equal(transportHome(b.home, b.legacy), b.home);
  legacyProfile(b.legacy);
  assert.equal(transportHome(b.home, b.legacy), b.legacy);
  mkdirSync(b.home);
  assert.equal(transportHome(b.home, b.legacy), b.home);
});

test("an idle legacy home moves once and leaves a symlink; the profile comes along", () => {
  const b = box();
  legacyProfile(b.legacy);
  assert.equal(migrateTransportHome(b.home, b.legacy, () => false), "moved");
  assert.equal(readFileSync(join(b.home, "browser-profile", "Cookies"), "utf8"), "signed-in");
  assert.ok(lstatSync(b.legacy).isSymbolicLink());
  assert.equal(readlinkSync(b.legacy), b.home);
  assert.equal(readFileSync(join(b.legacy, "browser-profile", "Cookies"), "utf8"), "signed-in");
  assert.equal(migrateTransportHome(b.home, b.legacy, () => false), "none");
});

test("a profile held by a live Chrome is never moved", () => {
  const b = box();
  legacyProfile(b.legacy);
  assert.equal(migrateTransportHome(b.home, b.legacy, (profile) => profile === join(b.legacy, "browser-profile")), "deferred");
  assert.ok(lstatSync(b.legacy).isDirectory());
  assert.equal(existsSync(b.home), false);
});

test("nothing to move when there is no legacy home or the new one exists", () => {
  const fresh = box();
  assert.equal(migrateTransportHome(fresh.home, fresh.legacy, () => false), "none");
  const both = box();
  legacyProfile(both.legacy);
  mkdirSync(both.home);
  assert.equal(migrateTransportHome(both.home, both.legacy, () => false), "none");
  assert.ok(lstatSync(both.legacy).isDirectory());
});
