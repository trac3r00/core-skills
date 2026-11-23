---
name: ci-test-rebuild
description: "Rebuild JS/TS tests and checks as a fast local Bun gate, proven by before/after metrics. Use for slow or bloated tests/CI. Not for one failing test (debugging)."
version: 0.5.0
license: MIT
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [ci, testing, bun, javascript, typescript, performance]
---

# CI Test Rebuild (local, Bun)

Make the check loop local, targeted and fast, then prove it with numbers.
Everything runs on the developer's machine with Bun builtins; no cloud runner,
no GitHub Actions, no new dependency. Delete more than you add. A faster green
that runs fewer tests, or a speedup that adds packages and config, is a
failure.

Idea source: Owen Gretzinger, "How I made our CI 20x faster" (X Article,
2026), translated to a local Bun pipeline. Read
[references/levers.md](references/levers.md) when choosing a lever and
[references/sources.md](references/sources.md) for provenance and limits.

## Inputs and limits

Require Bun >= 1.4 (`bun --version`) and a git repository. Read
`package.json`, lockfile, tsconfig, test files and helpers, existing hooks,
`.github/workflows/`, `AGENTS.md`/`Rules.md`.

- A request to speed up or rebuild tests/CI authorizes editing tests, test
  setup, `package.json` scripts, the git hook, and removing dependencies or
  config that the change makes unused. Leave changes uncommitted unless the
  user asked for commits.
- Ask before deleting a workflow that does more than test/lint/typecheck
  (release, publish, deploy), before reformatting the whole codebase, and
  before deleting or skipping any test.
- Never add a dependency, a tooling config file, a wrapper script around one
  command, a docs file, or comment banners. The only files this skill may add
  are `.githooks/pre-push` and, when isolation is turned off, one test preload.
  Never copy this skill's helper into the repository.

## 1. Baseline (before)

Pick commands that represent the current loop, then snapshot them:

```bash
bun <skill-dir>/scripts/bench.ts snap --out /tmp/ctr-before.json --cmd 'full=<current full test command>' \
  --cmd 'gate=<current pre-push or check command>' --cmd 'typecheck=<current typecheck>'
```

Default is 1 warmup plus 3 timed runs per command. The snapshot also records
dependency and devDependency counts, `package.json` scripts, tracked files,
tooling/CI config files, and `node_modules` size. Keep snapshots outside the
repo. If a command fails at baseline, record it and fix nothing yet.

## 2. Remove bloat

1. Run `bun fmt --doctor` (confirm with `bun fmt --help` first; skip if
   absent) and list each devDependency with where it is used
   (imports, scripts, config). Bun builtins replace, when verified on this repo:
   jest/vitest/mocha -> `bun test`; ts-node/tsx/nodemon -> `bun`/`bun --watch`;
   concurrently/npm-run-all -> `bun run --parallel` or shell `&` + `wait`;
   dotenv -> Bun's automatic `.env` loading; rimraf -> `rm -rf`;
   prettier -> `bun fmt` (only if `bun fmt --check .` is clean, otherwise ask).
2. Migrate a test runner only if the suite passes under `bun test` with
   import changes alone; otherwise keep it and report why.
3. Remove with `bun remove <pkg>`; delete the tool's config files and its now
   dead scripts. Delete CI workflows whose only job is test/lint/typecheck,
   because the local gate replaces them.

## 3. Rebuild the loop

1. **Full run**: time `bun test`, `bun test --parallel`, and
   `bun test --parallel --no-isolate`; keep the fastest that passes twice with
   `--randomize`. If `--no-isolate` leaks state between files, add one preload
   (`[test] preload` in an existing `bunfig.toml`, or `--preload` in the
   script) that resets shared state after each file, and add one line to an
   existing `AGENTS.md`/README saying what a test must clean up.
2. **Targeted gate**: copy [assets/pre-push](assets/pre-push) to
   `.githooks/pre-push` (executable) and enable it with
   `git config core.hooksPath .githooks`. If the repo already sets
   `core.hooksPath`, put the hook there instead. If it uses husky or
   lefthook, replace it with this hook and remove that dependency.

   Adjust `main`, the extension list, and drop `bun fmt` if the repo does not
   use it. The hook runs format, typecheck and `bun test --changed` in
   parallel. Its inline `bun -e` walks imports from every tracked test file
   and fails on any changed source file no test reaches (`bun test --changed`
   alone exits 0 when nothing is affected). Unresolvable imports, such as
   uninstalled packages, are skipped, so they only make the check stricter.
   Always pass `--no-script`: when `package.json` has a `check`
   script, plain `bun check` runs that script instead of the typechecker.
   `bun check` stays whole-project: checking only changed files misses
   breakage in the files that import them. Config/lockfile changes run
   everything because the import graph cannot see them.
3. **Scripts**: keep one `test` (fastest full run) and one `check`
   (`bun fmt --check . && bun check --no-script && bun test`); delete scripts that only
   wrapped removed tools.

## 4. Prove it still fails

Run each on a scratch branch or `git stash`-protected tree; never commit them.

- A failing assertion in a test reached by a changed source file: gate exits 1.
- A changed source file no test imports: gate exits 1 and names it.
- A type error in a file the changed file's dependents use: gate exits 1.
- A lockfile or `package.json` change: gate runs the full suite.
- Full run twice with `--randomize` and different `--seed`: same results.
- Every removed package: `bun check` and full `bun test` still pass.

## 5. After snapshot and comparison

```bash
bun <skill-dir>/scripts/bench.ts snap --out /tmp/ctr-after.json --cmd 'full=bun test ...' \
  --cmd 'gate=sh .githooks/pre-push' --cmd 'typecheck=bun check --no-script'
bun <skill-dir>/scripts/bench.ts compare /tmp/ctr-before.json /tmp/ctr-after.json --allow-fewer-tests gate
```

`compare` prints a markdown table and exits 1 when any command became slower
than 10% (`--tolerance`), a passing command now fails, a new label fails, a
label ran fewer tests or lost its test summary (except labels passed to
`--allow-fewer-tests`, used for the targeted gate), the total dependency
count grew, or a tooling/CI config file was added.
More tracked files are flagged for review. Fix the cause; never loosen a gate
to pass. Run `gate` from a branch with a representative change so it measures
the targeted path, and say which change it was.

## 6. Private CI box (optional)

When the user wants full runs off their laptop but not on hosted CI, set up
one container on their own Proxmox VE server where `git push ci` runs the full
suite and rejects the push on failure. Read
[references/pve-runner.md](references/pve-runner.md). It adds a git remote, not
repository files. Container changes need the user's approval in the session
and go through their own Proxmox access. Add its `remote-full` row to the
comparison.

## 7. Report

Paste the comparison table verbatim, then list: packages, configs, workflows
and scripts removed; files added (at most the hook and preload); each proof
check with its exit code; levers tried and reverted; anything skipped and why.
Label every number measured or estimated; there are no estimated numbers in
the table.

## Helper

`scripts/bench.ts` (Bun, no dependencies, no network). `snap --out FILE
[--cwd DIR] [--runs 1..50] [--warmup 0..10] [--timeout SEC] --cmd label=command
...`; `compare BEFORE AFTER [--allow-fewer-tests LABEL]... [--tolerance PCT]`.
Exit 0 ok, 1 gate failed, 2 usage, 3 runtime error. Tests:
`node --test <skill-dir>/test/*.test.mjs` (Node 24+ and Bun on PATH).

Invoke: `/skill:ci-test-rebuild <repo or goal>` or `$ci-test-rebuild`.
Revisit when Bun changes `bun test --changed`, `bun check`, or `bun fmt`
behavior. Effectiveness is unbenchmarked beyond one synthetic demo
(references/sources.md).
