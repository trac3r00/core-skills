#!/usr/bin/env bun
// bench: snapshot local check timings and bloat metrics, then compare two
// snapshots as a before/after table with gates.
//
//   bun bench.ts snap --out FILE [--cwd DIR] [--runs N] [--warmup N] [--timeout SEC] --cmd 'label=command' ...
//   bun bench.ts compare BEFORE AFTER [--allow-fewer-tests LABEL]... [--tolerance PCT]
//
// snap runs each command with `sh -c` in --cwd (default .), N timed runs after
// warmup, and reads repo metrics from package.json and `git ls-files`.
// No network. Exit codes: 0 ok, 1 compare gate failed, 2 usage, 3 runtime error.

import { basename } from "node:path";

export type Run = { ms: number; code: number | null };
export type Tests = { pass: number; fail: number; ran: number; files: number };
export type Command = { cmd: string; runs: Run[]; medianMs: number; ok: boolean; tests: Tests | null };
export type Repo = { deps: number; devDeps: number; scripts: number; trackedFiles: number; configFiles: string[]; nodeModulesKB: number | null };
export type Snapshot = { version: 1; takenAt: string; head: string | null; dirty: boolean; bun: string; commands: Record<string, Command>; repo: Repo };

const BLOAT_CONFIG_BASENAMES = [
  /^\.?eslint(rc)?(\..*)?$/, /^eslint\.config\./, /^\.prettierrc/, /^prettier\.config\./,
  /^jest\.config\./, /^vitest\.config\./, /^vite\.config\./, /^babel\.config\./, /^\.babelrc/,
  /^\.swcrc$/, /^nodemon\.json$/, /^webpack\.config\./, /^rollup\.config\./, /^tsup\.config\./,
  /^lefthook\.ya?ml$/, /^\.lintstagedrc/, /^lint-staged\.config\./, /^\.huskyrc/, /^tsconfig.*\.json$/,
  /^bunfig\.toml$/, /^\.nvmrc$/, /^\.node-version$/, /^turbo\.json$/, /^nx\.json$/,
];

export function isConfigFile(path: string): boolean {
  if (/^\.github\/workflows\//.test(path) || /^\.husky\//.test(path) || /^\.circleci\//.test(path)) return true;
  if (/(^|\/)node_modules\//.test(path)) return false;
  const b = basename(path);
  return BLOAT_CONFIG_BASENAMES.some((re) => re.test(b));
}

export function sumBunTestSummaries(raw: string): Tests | null {
  const text = raw
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^remote: /, "").trimEnd())
    .join("\n");
  const sum = (re: RegExp) => [...text.matchAll(re)].reduce((n, m) => n + Number(m[1]), 0);
  const ranMatches = [...text.matchAll(/^Ran (\d+) tests? across (\d+) files?\./gm)];
  if (ranMatches.length === 0) return null;
  return {
    pass: sum(/^\s*(\d+) pass$/gm),
    fail: sum(/^\s*(\d+) fail$/gm),
    ran: ranMatches.reduce((n, m) => n + Number(m[1]), 0),
    files: ranMatches.reduce((n, m) => n + Number(m[2]), 0),
  };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type Row = { metric: string; before: string; after: string; delta: string; flag: "" | "FAIL" | "review" };

export function compare(a: Snapshot, b: Snapshot, opts: { allowFewer?: string[]; tolerancePct?: number } = {}) {
  const tol = opts.tolerancePct ?? 10;
  const allow = new Set(opts.allowFewer ?? []);
  const rows: Row[] = [];
  const failures: string[] = [];
  const pct = (x: number, y: number) => (x === 0 ? (y === 0 ? "0%" : "new") : `${(((y - x) / x) * 100).toFixed(0)}%`);
  const num = (metric: string, x: number, y: number, bad: boolean, unit = "", fmt = (v: number) => String(v)) => {
    const d = y - x;
    rows.push({ metric, before: fmt(x) + unit, after: fmt(y) + unit, delta: `${d > 0 ? "+" : ""}${fmt(d)}${unit} (${pct(x, y)})`, flag: bad ? "FAIL" : "" });
  };
  const secs = (v: number) => (v / 1000).toFixed(2);
  const labels = [...new Set([...Object.keys(a.commands), ...Object.keys(b.commands)])];
  for (const l of labels) {
    const x = a.commands[l];
    const y = b.commands[l];
    if (!x || !y) {
      rows.push({ metric: `${l} time`, before: x ? `${secs(x.medianMs)}s` : "-", after: y ? `${secs(y.medianMs)}s` : "-", delta: x ? "removed" : "added", flag: "review" });
      const t = (x ?? y)!.tests;
      if (t) rows.push({ metric: `${l} tests ran`, before: x ? String(t.ran) : "-", after: y ? String(t.ran) : "-", delta: x ? "removed" : "added", flag: "review" });
      if (y && !y.ok) failures.push(`${l}: new command fails`);
      continue;
    }
    const slower = y.medianMs > x.medianMs * (1 + tol / 100);
    num(`${l} time (median)`, x.medianMs, y.medianMs, slower, "s", secs);
    if (slower) failures.push(`${l}: slower than before by more than ${tol}%`);
    if (x.ok && !y.ok) {
      rows.push({ metric: `${l} status`, before: "pass", after: "FAIL", delta: "regressed", flag: "FAIL" });
      failures.push(`${l}: passed before, fails after`);
    }
    if (x.tests && y.tests) {
      const fewer = y.tests.ran < x.tests.ran && !allow.has(l);
      num(`${l} tests ran`, x.tests.ran, y.tests.ran, fewer);
      num(`${l} test files`, x.tests.files, y.tests.files, false);
      if (fewer) failures.push(`${l}: ran fewer tests (${x.tests.ran} -> ${y.tests.ran})`);
    } else if (x.tests && !y.tests && !allow.has(l)) {
      failures.push(`${l}: test summary disappeared`);
      rows.push({ metric: `${l} tests ran`, before: String(x.tests.ran), after: "-", delta: "missing", flag: "FAIL" });
    }
  }
  const depsUp = b.repo.deps + b.repo.devDeps > a.repo.deps + a.repo.devDeps;
  num("dependencies", a.repo.deps, b.repo.deps, b.repo.deps > a.repo.deps);
  num("devDependencies", a.repo.devDeps, b.repo.devDeps, b.repo.devDeps > a.repo.devDeps);
  if (depsUp) failures.push("dependency count increased");
  num("package.json scripts", a.repo.scripts, b.repo.scripts, false);
  const cfgUp = b.repo.configFiles.length > a.repo.configFiles.length;
  num("config/CI files", a.repo.configFiles.length, b.repo.configFiles.length, cfgUp);
  if (cfgUp) {
    const added = b.repo.configFiles.filter((f) => !a.repo.configFiles.includes(f));
    failures.push(`config files increased: ${added.join(", ")}`);
  }
  num("tracked files", a.repo.trackedFiles, b.repo.trackedFiles, false);
  if (b.repo.trackedFiles > a.repo.trackedFiles) rows[rows.length - 1].flag = "review";
  if (a.repo.nodeModulesKB !== null && b.repo.nodeModulesKB !== null) {
    num("node_modules", a.repo.nodeModulesKB, b.repo.nodeModulesKB, false, " MB", (v) => (v / 1024).toFixed(1));
  }
  return { rows, failures };
}

export function renderTable(rows: Row[]): string {
  const out = ["| metric | before | after | delta | gate |", "| --- | ---: | ---: | ---: | --- |"];
  for (const r of rows) out.push(`| ${r.metric} | ${r.before} | ${r.after} | ${r.delta} | ${r.flag} |`);
  return out.join("\n");
}

class UsageError extends Error {}

// Git exports these inside hooks; inherited, they make git ignore `cwd` and act on another repository.
const GIT_LOCATION_VARS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR", "GIT_NAMESPACE", "GIT_PREFIX", "GIT_QUARANTINE_PATH"];
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !GIT_LOCATION_VARS.includes(k)));

async function sh(cmd: string[], cwd: string, timeoutMs = 60_000) {
  const p = Bun.spawn(cmd, { cwd, env: childEnv, stdout: "pipe", stderr: "pipe", timeout: timeoutMs });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return { code: await p.exited, text: out + err };
}

async function repoMetrics(cwd: string): Promise<Repo> {
  const pkgFile = Bun.file(`${cwd}/package.json`);
  const pkg = (await pkgFile.exists()) ? await pkgFile.json() : {};
  const files = await sh(["git", "ls-files"], cwd);
  if (files.code !== 0) throw new Error(`git ls-files failed in ${cwd}`);
  const tracked = files.text.split("\n").filter(Boolean);
  let nodeModulesKB: number | null = null;
  if ((await sh(["test", "-d", "node_modules"], cwd)).code === 0) {
    const du = await sh(["du", "-sk", "node_modules"], cwd);
    if (du.code === 0) nodeModulesKB = Number(du.text.split(/\s/)[0]);
  }
  return {
    deps: Object.keys(pkg.dependencies ?? {}).length,
    devDeps: Object.keys(pkg.devDependencies ?? {}).length,
    scripts: Object.keys(pkg.scripts ?? {}).length,
    trackedFiles: tracked.length,
    configFiles: tracked.filter(isConfigFile).sort(),
    nodeModulesKB,
  };
}

async function snap(o: { out: string; cwd: string; runs: number; warmup: number; timeoutS: number; cmds: [string, string][] }) {
  const commands: Record<string, Command> = {};
  for (const [label, cmd] of o.cmds) {
    const runs: Run[] = [];
    let lastText = "";
    for (let i = 0; i < o.warmup + o.runs; i++) {
      const t0 = performance.now();
      const r = await sh(["sh", "-c", cmd], o.cwd, o.timeoutS * 1000);
      const ms = performance.now() - t0;
      lastText = r.text;
      if (i >= o.warmup) runs.push({ ms: Math.round(ms), code: r.code });
    }
    const ok = runs.every((r) => r.code === 0);
    commands[label] = { cmd, runs, medianMs: median(runs.map((r) => r.ms)), ok, tests: sumBunTestSummaries(lastText) };
    console.error(`${label}: median ${(commands[label].medianMs / 1000).toFixed(2)}s ${ok ? "ok" : "FAILED"}`);
  }
  const head = await sh(["git", "rev-parse", "--short", "HEAD"], o.cwd);
  const status = await sh(["git", "status", "--porcelain"], o.cwd);
  const s: Snapshot = {
    version: 1,
    takenAt: new Date().toISOString(),
    head: head.code === 0 ? head.text.trim() : null,
    dirty: status.text.trim().length > 0,
    bun: Bun.version,
    commands,
    repo: await repoMetrics(o.cwd),
  };
  await Bun.write(o.out, JSON.stringify(s, null, 2));
  console.log(`wrote ${o.out}`);
}

function parseArgs(argv: string[]) {
  const [mode, ...rest] = argv;
  if (mode === "snap") {
    const o = { out: "", cwd: ".", runs: 3, warmup: 1, timeoutS: 600, cmds: [] as [string, string][] };
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      const v = rest[i + 1];
      if (v === undefined) throw new UsageError(`missing value for ${a}`);
      i++;
      if (a === "--out") o.out = v;
      else if (a === "--cwd") o.cwd = v;
      else if (a === "--runs") o.runs = Number(v);
      else if (a === "--warmup") o.warmup = Number(v);
      else if (a === "--timeout") o.timeoutS = Number(v);
      else if (a === "--cmd") {
        const eq = v.indexOf("=");
        if (eq < 1) throw new UsageError(`--cmd must be label=command: ${v}`);
        o.cmds.push([v.slice(0, eq), v.slice(eq + 1)]);
      } else throw new UsageError(`unknown argument: ${a}`);
    }
    if (!o.out || o.cmds.length === 0) throw new UsageError("snap needs --out and at least one --cmd");
    for (const [k, n, lo, hi] of [["--runs", o.runs, 1, 50], ["--warmup", o.warmup, 0, 10], ["--timeout", o.timeoutS, 1, 7200]] as const) {
      if (!Number.isInteger(n) || n < lo || n > hi) throw new UsageError(`${k} must be an integer ${lo}..${hi}`);
    }
    return { mode, o } as const;
  }
  if (mode === "compare") {
    const files: string[] = [];
    const allowFewer: string[] = [];
    let tolerancePct = 10;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--allow-fewer-tests" && rest[i + 1]) allowFewer.push(rest[++i]);
      else if (rest[i] === "--tolerance" && rest[i + 1]) tolerancePct = Number(rest[++i]);
      else if (rest[i].startsWith("--")) throw new UsageError(`unknown argument: ${rest[i]}`);
      else files.push(rest[i]);
    }
    if (files.length !== 2) throw new UsageError("compare needs BEFORE and AFTER");
    if (!Number.isFinite(tolerancePct) || tolerancePct < 0) throw new UsageError("--tolerance must be >= 0");
    return { mode, files, allowFewer, tolerancePct } as const;
  }
  throw new UsageError("usage: bench.ts snap ... | bench.ts compare BEFORE AFTER");
}

async function main() {
  let args;
  try {
    args = parseArgs(Bun.argv.slice(2));
  } catch (e) {
    console.error(`bench: ${(e as Error).message}`);
    process.exit(2);
  }
  try {
    if (args.mode === "snap") return await snap(args.o);
    const [a, b] = await Promise.all(args.files.map((f) => Bun.file(f).json() as Promise<Snapshot>));
    if (a.version !== 1 || b.version !== 1) throw new Error("not a bench snapshot (version 1)");
    const { rows, failures } = compare(a, b, args);
    console.log(renderTable(rows));
    if (failures.length) {
      console.log(`\nGATE FAILED:\n${failures.map((f) => `- ${f}`).join("\n")}`);
      process.exit(1);
    }
    console.log("\nGATE OK");
  } catch (e) {
    console.error(`bench: ${(e as Error).message}`);
    process.exit(3);
  }
}

if (import.meta.main) await main();
