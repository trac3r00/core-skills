import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compare, isConfigFile, sumBunTestSummaries } from "../scripts/bench.ts";

const SEED = 0xbe7c;
const CASES = 300;
const BENCH = join(import.meta.dirname, "../scripts/bench.ts");
// Hooks export GIT_DIR and friends; fixture git commands must not inherit them and write into the host repo.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|COMMON_DIR|NAMESPACE|PREFIX|QUARANTINE_PATH)$/.test(k)));

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r, n) => Math.floor(r() * n);

function genOutput(r) {
  const k = 1 + int(r, 3);
  const want = { pass: 0, fail: 0, ran: 0, files: 0 };
  const lines = [];
  for (let i = 0; i < k; i++) {
    const pass = int(r, 500), fail = int(r, 4), skip = int(r, 3), files = 1 + int(r, 40);
    const ran = pass + fail + skip;
    lines.push("(pass) suite > 12 pass", "(fail) other > it 3 fail", "noise: Ran tests later", ` ${pass} pass`);
    if (skip) lines.push(` ${skip} skip`);
    lines.push(` ${fail} fail`, ` ${int(r, 9999)} expect() calls`);
    lines.push(`Ran ${ran} test${ran === 1 ? "" : "s"} across ${files} file${files === 1 ? "" : "s"}. [12.00ms]`);
    want.pass += pass; want.fail += fail; want.ran += ran; want.files += files;
  }
  return { text: lines.join("\n"), want, k };
}

function genSnap(r) {
  const commands = {};
  for (const label of ["full", "targeted", "typecheck"].filter(() => r() < 0.8)) {
    const ms = 100 + int(r, 60_000);
    const ran = int(r, 2000);
    commands[label] = { cmd: label, runs: [{ ms, code: 0 }], medianMs: ms, ok: true, tests: label === "typecheck" ? null : { pass: ran, fail: 0, ran, files: 1 + int(r, 50) } };
  }
  const configFiles = ["package.json", "tsconfig.json", "eslint.config.js", ".github/workflows/ci.yml"].filter(() => r() < 0.5);
  return { version: 1, takenAt: "t", head: null, dirty: false, bun: "1.4.4", commands, repo: { deps: int(r, 30), devDeps: int(r, 30), scripts: int(r, 15), trackedFiles: 10 + int(r, 900), configFiles, nodeModulesKB: r() < 0.5 ? int(r, 900_000) : null } };
}

describe("sumBunTestSummaries", () => {
  test("sums every summary and ignores look-alike lines (generated)", () => {
    const r = rng(SEED);
    for (let i = 0; i < CASES; i++) {
      const { text, want } = genOutput(r);
      assert.deepEqual(sumBunTestSummaries(text), want);
    }
  });

  test("git push remote output (prefix, padding, color codes) parses the same", () => {
    const r = rng(SEED + 7);
    for (let i = 0; i < CASES; i++) {
      const { text, want } = genOutput(r);
      const remote = text.split("\n").map((l) => `remote: ${r() < 0.3 ? "\x1b[0m" : ""}${l}${" ".repeat(int(r, 9))}${r() < 0.3 ? "\x1b[K" : ""}`).join("\r\n");
      assert.deepEqual(sumBunTestSummaries(remote), want);
    }
  });

  test("no summary means unknown, not zero", () => {
    assert.equal(sumBunTestSummaries("error: Script not found\n 3 pass"), null);
  });

  test("calibration: a first-summary-only parser is rejected", () => {
    const firstOnly = (t) => Number(t.match(/^Ran (\d+) tests?/m)?.[1]);
    const r = rng(SEED);
    let multi = 0, caught = 0;
    for (let i = 0; i < CASES; i++) {
      const { text, want, k } = genOutput(r);
      if (k < 2) continue;
      multi++;
      if (firstOnly(text) !== want.ran || want.ran === 0) caught++;
    }
    assert.ok(multi > 50);
    assert.ok(caught > multi * 0.9);
  });
});

test("isConfigFile", () => {
  const cases = [
    [".github/workflows/ci.yml", true], ["src/vitest.config.ts", true], ["tsconfig.build.json", true],
    [".husky/pre-push", true], ["eslint.config.mjs", true], [".prettierrc", true], ["bunfig.toml", true],
    ["node_modules/x/eslint.config.js", false], ["src/config.ts", false], ["package.json", false], [".githooks/pre-push", false],
  ];
  for (const [path, want] of cases) assert.equal(isConfigFile(path), want, path);
});

describe("compare gates (metamorphic, generated)", () => {
  const r = rng(SEED + 1);
  const snaps = Array.from({ length: CASES }, () => genSnap(r));

  test("identical snapshots never fail", () => {
    for (const s of snaps) assert.deepEqual(compare(s, structuredClone(s)).failures, []);
  });

  test("faster, same coverage and size never fails", () => {
    for (const s of snaps) {
      const b = structuredClone(s);
      for (const c of Object.values(b.commands)) c.medianMs = Math.floor(c.medianMs * r());
      assert.deepEqual(compare(s, b).failures, []);
    }
  });

  test("any added dependency fails", () => {
    for (const s of snaps) {
      const b = structuredClone(s);
      if (r() < 0.5) b.repo.deps++; else b.repo.devDeps++;
      assert.ok(compare(s, b).failures.includes("dependency count increased"));
    }
  });

  test("swapping one dependency for a devDependency is not growth", () => {
    for (const s of snaps.filter((x) => x.repo.deps > 0)) {
      const b = structuredClone(s);
      b.repo.deps--; b.repo.devDeps++;
      assert.ok(!compare(s, b).failures.includes("dependency count increased"));
    }
  });

  test("an added config/CI file fails and is named", () => {
    for (const s of snaps) {
      const b = structuredClone(s);
      b.repo.configFiles = [...b.repo.configFiles, "vitest.config.ts"];
      assert.ok(compare(s, b).failures.some((f) => f.includes("vitest.config.ts")));
    }
  });

  test("fewer tests fails unless the label is allowed", () => {
    let executed = 0;
    for (const s of snaps) {
      const labels = Object.entries(s.commands).filter(([, c]) => c.tests && c.tests.ran > 0).map(([l]) => l);
      if (!labels.length) continue;
      const l = labels[int(r, labels.length)];
      const b = structuredClone(s);
      b.commands[l].tests.ran -= 1 + int(r, b.commands[l].tests.ran);
      assert.ok(compare(s, b).failures.some((f) => f.startsWith(`${l}: ran fewer tests`)));
      assert.deepEqual(compare(s, b, { allowFewer: [l] }).failures, []);
      executed++;
    }
    assert.ok(executed > CASES / 2);
  });

  test("pass -> fail regression fails", () => {
    for (const s of snaps) {
      const l = Object.keys(s.commands)[0];
      if (!l) continue;
      const b = structuredClone(s);
      b.commands[l].ok = false;
      assert.ok(compare(s, b).failures.includes(`${l}: passed before, fails after`));
    }
  });

  test("slower beyond tolerance fails, within tolerance passes", () => {
    for (const s of snaps) {
      const l = Object.keys(s.commands)[0];
      if (!l) continue;
      const slow = structuredClone(s), ok = structuredClone(s);
      slow.commands[l].medianMs = s.commands[l].medianMs * 1.2;
      ok.commands[l].medianMs = s.commands[l].medianMs * 1.05;
      assert.ok(compare(s, slow).failures.some((f) => f.startsWith(`${l}: slower`)));
      assert.deepEqual(compare(s, ok).failures, []);
    }
  });

  test("a command only in AFTER shows its test count and does not fail when it passes", () => {
    const b = structuredClone(snaps[0]);
    b.commands["remote-full"] = { cmd: "git push ci", runs: [{ ms: 1200, code: 0 }], medianMs: 1200, ok: true, tests: { pass: 60, fail: 0, ran: 60, files: 30 } };
    const res = compare(snaps[0], b);
    assert.deepEqual(res.failures, []);
    const row = res.rows.find((x) => x.metric === "remote-full tests ran");
    assert.equal(row?.after, "60");
    assert.equal(row?.delta, "added");
  });

  test("more tracked files is flagged for review, not failed", () => {
    const b = structuredClone(snaps[0]);
    b.repo.trackedFiles += 3;
    const res = compare(snaps[0], b);
    assert.deepEqual(res.failures, []);
    assert.equal(res.rows.find((x) => x.metric === "tracked files")?.flag, "review");
  });
});

describe("bench CLI on a real repo (needs bun)", () => {
  const dir = mkdtempSync(join(tmpdir(), "bench-cli-test-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (args, env = cleanEnv) => spawnSync("bun", [BENCH, ...args], { cwd: dir, encoding: "utf8", env });

  test("snap counts real bun tests; compare gates removed tests and new deps", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fx", devDependencies: {} }));
    writeFileSync(join(dir, "src/a.test.ts"), `import {test,expect} from "bun:test"; test("a",()=>expect(1).toBe(1)); test("b",()=>expect(2).toBe(2));`);
    writeFileSync(join(dir, "src/b.test.ts"), `import {test,expect} from "bun:test"; test("c",()=>expect(3).toBe(3));`);
    assert.equal(spawnSync("sh", ["-c", "git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init"], { cwd: dir, env: cleanEnv }).status, 0);

    assert.equal(run(["snap", "--out", "before.json", "--runs", "1", "--warmup", "0", "--cmd", "full=bun test"]).status, 0);
    const before = JSON.parse(readFileSync(join(dir, "before.json"), "utf8"));
    assert.deepEqual(before.commands.full.tests, { pass: 3, fail: 0, ran: 3, files: 2 });
    assert.equal(before.repo.trackedFiles, 3);

    rmSync(join(dir, "src/b.test.ts"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fx", devDependencies: { jest: "1" } }));
    assert.equal(run(["snap", "--out", "after.json", "--runs", "1", "--warmup", "0", "--cmd", "full=bun test"]).status, 0);
    const cmp = run(["compare", "before.json", "after.json", "--tolerance", "1000"]);
    assert.equal(cmp.status, 1);
    assert.match(cmp.stdout, /full: ran fewer tests \(3 -> 2\)/);
    assert.match(cmp.stdout, /dependency count increased/);
    assert.match(cmp.stdout, /\| metric \| before \| after \| delta \| gate \|/);
  });

  test("regression: an inherited GIT_DIR does not redirect repo metrics", () => {
    const decoy = join(dir, "decoy.git");
    assert.equal(spawnSync("git", ["init", "-q", "--bare", decoy], { env: cleanEnv }).status, 0);
    assert.equal(run(["snap", "--out", "leak.json", "--runs", "1", "--warmup", "0", "--cmd", "x=true"], { ...cleanEnv, GIT_DIR: decoy }).status, 0);
    const snap = JSON.parse(readFileSync(join(dir, "leak.json"), "utf8"));
    const tracked = spawnSync("git", ["ls-files"], { cwd: dir, env: cleanEnv, encoding: "utf8" }).stdout.split("\n").filter(Boolean).length;
    assert.ok(tracked > 0);
    assert.equal(snap.repo.trackedFiles, tracked);
    assert.notEqual(snap.head, null);
  });

  test("usage errors exit 2", () => {
    assert.equal(run(["snap", "--out", "x.json"]).status, 2);
    assert.equal(run(["compare", "only-one.json"]).status, 2);
    assert.equal(run(["bogus"]).status, 2);
  });
});
