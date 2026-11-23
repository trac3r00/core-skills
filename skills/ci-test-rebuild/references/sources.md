# Sources

Read when checking where a rule came from or what is unverified.

- Idea source: Owen Gretzinger (@owengretzinger, head of engineering at
  Boardy), "How I made our CI 20x faster (steal this)", X Article linked from
  https://x.com/owengretzinger/status/2116291924219060319 . Text retrieved
  2026-10-31 via the public fxtwitter API. Embedded media were not retrieved.
  Its numbers describe cloud CI for their repo and were not reproduced.
- Local translation is the skill author's, at the user's direction: no cloud
  CI or GitHub Actions, Bun builtins and targeted checks, a before/after
  metrics comparison, and no bloat.
- Bun behavior observed on Bun 1.4.4 (macOS arm64) on 2026-10-31:
  `bun test --help` lists `--changed`, `--parallel`, `--no-isolate`,
  `--randomize`, `--seed`, `--timings`, `--pass-with-no-tests`;
  `bun test --changed` with no affected test runs 0 tests and exits 0 (hence
  the hook's "reached no test" guard); `--changed=main` selects tests reached
  by committed branch changes; new untracked test files run; `bun check` exits
  1 on a type error and checking one file does not see errors in files it
  does not import; `bun fmt` has `--check`, `--changed`, `--doctor`.
- Also observed: Bun loads `.env` into `process.env` without dotenv;
  `bunfig.toml` `[test] preload` runs before tests; with a `check` script in
  `package.json`, plain `bun check` runs that script (hence `--no-script`).
- Demo, 2026-10-31, synthetic repo (30 test files importing one heavy module,
  8 unused devDependencies, 5 dead tool/CI configs), median of 3 runs: full
  run 0.72 s -> 0.10 s, pre-push gate 0.85 s -> 0.28 s for a one-file change,
  typecheck 0.12 s -> 0.09 s, devDependencies 8 -> 0, config/CI files 6 -> 1,
  60 of 60 tests still run in the full suite. `bun test --parallel` was slower
  than plain `bun test` there (0.28 s vs 0.06 s), so measure, do not assume.
  One synthetic repo is not evidence for real repositories.
- Private CI box, 2026-10-31: Proxmox VE 9.2 LXC (Debian 13.6, 4 cores,
  4 GiB, Bun 1.4.4) on a busy host. Same demo repo: `git push ci` full run
  1.22 s median including SSH through the Proxmox host, 60/60 tests; failing
  test and type error pushes rejected with the remote branch unchanged;
  branch deletion ran nothing; no leftover run directories.
- Observed 2026-10-31: in a bare repository with linked worktrees, git
  exports `GIT_DIR` to hooks, and a test that builds its own fixture repo
  then commits into the host branch (the pre-push gate failed and the branch
  tip became the fixture commit). In `pre-receive`, the inherited variables
  made such a test fail. Both hooks unset the git location variables before
  running checks, and `bench.ts` strips them from its child processes;
  re-run with the old and new hooks, only the old ones failed.
- `scripts/bench.ts` parses Bun's `Ran N tests across M files.` summary
  lines; recheck the regex after a Bun output change.
