# Levers: the article, translated to local Bun

Read when choosing what to change. "Source" is what Owen Gretzinger reported
for his team's cloud CI (their numbers, not reproduced). "Local" is how this
skill applies the idea without cloud CI. Measure every lever with
`scripts/bench.ts`; keep only measured wins.

| # | Source lever (reported) | Local equivalent |
| --- | --- | --- |
| 1 | Faster runners: queue 11 min to 8 s; 40 to ~10 min total | No queue at all: the gate runs on the developer machine before push |
| 2 | ESLint to Oxlint: lint 2 min to 5 s | Remove linters whose rules `bun check` (strict tsconfig) already covers; keep a linter only for rules it uniquely enforces, and never add one |
| 3 | Fastest typechecker: tsc 70 s, TS7 13 s, `bun check` under 5 s | `bun check` (same errors as tsc, all cores); whole-project in the gate |
| 4 | Shard onto bigger machines (8-min target, 6 shards, 8 vCPU) | `bun test --parallel` uses all local cores; `--timings` starts slow files first if it measures faster |
| 5 | Vitest `isolate: false`: shard 100 s to 35 s; reset hook after each file | `bun test --parallel --no-isolate` plus one reset preload, only if measured faster and order-stable under `--randomize` |
| 6 | Fix setup: cache seeded from main, node_modules cache, blobless clone, concurrency = cores | No CI setup to pay; drop reinstall steps from scripts; keep `--parallel` at the core count |
| 7 | Run lint, typecheck, build, tests in parallel | Shell `&` + `wait` in the hook, or `bun run --parallel` |
| 8 | `nx affected` on PRs, full suite nightly; skip logic tested by hiding a change | `bun test --changed=<base>` in the gate; full run on config/lockfile changes and in `bun run check`; "changed code reached no test" fails |
| 9 | Pre-push hook: format, lint, typecheck in under 9 s; a hook, not an AGENTS.md line | `.githooks/pre-push` via `core.hooksPath`; budget measured with `bench.ts` |
| - | Deleting tests: audit of 20,000 cases found little | Do not delete tests to gain speed; remove only tests the user confirms are dead |
| - | Bill: about $230 to $4,300/month | Local gate costs no CI minutes |

## Bloat rules

- Each removal must leave `bun check` and the full `bun test` passing.
- Each addition must show a measured win in the comparison table and be one of
  the two allowed files (hook, preload).
- `bun fmt --doctor` lists packages Bun's formatter makes redundant.
- Only delete workflows whose sole purpose is test/lint/typecheck; ask for
  any workflow that releases, publishes, or deploys.
