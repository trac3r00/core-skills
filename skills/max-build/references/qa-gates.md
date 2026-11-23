# QA gates by deliverable (Finished-Product Standard)

Pick every row that applies to TASK's deliverable. Each listed check becomes a
pre-registered C# or S# in the ledger with its evidence surface. Pair this with
[finished-product.md](finished-product.md) (Zero-Toy Finished-Product Bar) and
[qa-testing-ci.md](qa-testing-ci.md) (V0-V3 budgets, token-budgeted digests,
Sealed Oracles, Evidence-Carrying Completion), then attack the result with the
[adversarial-qa.md](adversarial-qa.md) lens panel. A row that applies but cannot
run is UNKNOWN, never silently dropped.

| Deliverable | Required checks (finished-product bar) | Evidence |
| --- | --- | --- |
| Library or module | diagnostics, red-first regression, unit tests on spec values, typed error boundaries, zero stubs/placeholders, property campaign on input boundaries, mutation spot-check on critical paths | test digest, counts, seed, log path |
| Parser, codec, validator, protocol, state machine | everything above plus invalid-family rejection and shrunk regressions ([oracles.md](oracles.md)) | replay command, corpus path |
| CLI or script | run the real binary: `--help`, success path, bad/empty input, exit codes, strict stdout vs stderr, clean teardown | captured command output |
| HTTP or RPC API | real requests against a live local instance: success, auth failure, malformed body, real persistence/state, error contract | request/response pairs |
| UI or page | real wiring (no hardcoded demo mocks), all states (default/empty/loading/error/overflow), machine layout check + screenshots inspected at desktop (~1440px) & mobile (~390px) widths + light/dark where supported | box/overflow metrics, screenshots, interaction log |
| Terminal / TUI | real PTY rendered through browser xterm.js capture (never `tmux capture-pane` for color/layout/CJK) | rendered PNG, transcript |
| Built product or release | cold-start end-to-end journey as a real user with messy inputs, zero placeholders, clean build/rollback | journey log, build receipt |
| Performance or token/cost optimization | baseline first, immutable oracle, same workload & machine, before/after with denominator and simplicity check ([karpathy.md](karpathy.md)) | TSV trial log, metric table |
| Tests or CI pipeline | Tier 1-3 gap check, V0-V3 budgets, concurrency/path filters, SHA-pinning/least-privilege, affected-only + cache hit rate, failure digest ([qa-testing-ci.md](qa-testing-ci.md)) | before/after timings, config diff |
| Deep research or technical verdict | multi-axis saturation, claim graph with >=2 independent domains + counter-search for high-risk claims, code verification for contested technical claims, debate record, ranked sources, inline visual report where supported ([research-browsing.md](research-browsing.md)) | claim table, script receipts, citations |
| AI / agent system or eval | versioned golden set, judge-human agreement, contamination check, `pass@k`/`pass^k`, sealed oracle & claim-trace audit | eval table, sample size, receipts |
| Config, migration, install | apply on a fixture, re-apply (idempotence), roll back | fixture diff |
| Docs, skills, prompts | contract tests the repo has, all cross-file relative links resolve, zero machine-specific paths, every claim traced to a source | checker output, file and line |
| Concurrency or async | exact-event synchronization, bounded deadlines, repeated runs pass every time | run count and results |

## Execution & integrity rules

- **Run V0 before V1+:** check changed files and affected tests first; run the
  full suite once at the end.
- **Digest, don't flood:** write verbose test output to disk and keep only the
  structured failure digest (full assertion + final traceback frames) in context.
- **Sealed oracles:** never weaken or skip an existing test to go green; justify
  any test diff explicitly.
- **No toy passes:** a scenario that passes only because production paths are
  mocked or stubbed into agreement does not count.
- **Receipt-backed completion:** emit `VERIFIED` only from observed command,
  exit code, and diff receipts.

## QA scenario format

```text
S1 <name>
User: <who> wants <outcome>
Setup: <fixture, state, data>
Action: <exact steps, URL/payload, or literal command>
Expected: <single binary observable PASS/FAIL result>
Regression watched: <what previously worked and must still work>
Evidence: <file, screenshot, or command output that proves it>
```

Write scenarios from the user's side, including the unhappy path and at least
one thing that must not change.
