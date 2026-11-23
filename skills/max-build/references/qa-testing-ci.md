# Agent-Era QA, Testing, and CI Intelligence

Read in Phase 0/5 whenever a task touches tests, CI, build/verification loops,
codebase health, or AI/agent evaluation. Distilled from *QA and Testing
Techniques for the Agent Era* (2026); see [sources.md](sources.md) for
provenance and caveats.

Core thesis: **verification is now the bottleneck.** Agents produce code and
claims faster than CI, tests, and reviewers can check them, and agents game
weak checks often enough to measure. Treat compute, tokens, human attention,
and oracle integrity as metered budgets.

## 1. Tiered QA Standards (audit a repo, pick the next rung)

Tiers are cumulative. Use these criteria to diagnose a codebase's maturity and
recommend concrete next-tier upgrades under Core Issues & Next Leverage.

| Tier | Target | Key practices | Checkable bar |
| --- | --- | --- | --- |
| **Tier 1: Baseline** | Every serious repo | Code review; lint/format/typecheck; secret & dep scanning; equivalence/boundary unit tests; external-boundary integration tests; smoke suite; regression test per bug fix; pinned deps; written DoD; rollback path | Main always green; every bug fix ships red->green test; PR CI median <15 min; no secrets; third-party CI actions pinned to full commit SHA; flaky count tracked |
| **Tier 2: Advanced** | Fast-shipping or larger repos | Contract tests (over brittle E2E); property-based tests; mutation testing on critical modules; continuous fuzzing for parsers/protocols; sanitizers (ASan/UBSan/TSan); visual/a11y/perf budgets; affected-only tests from build graph; hermetic content-addressed builds + remote cache; merge queues; flaky quarantine with owner & SLA; progressive rollouts with SLO auto-revert; SAST/DAST, SBOM, SLSA Build L2-L3 | Mutation score tracked on critical paths; fuzz targets continuous; target >=80% PR CI cache hit rate; quarantined flakes have owners & expiry; signed provenance |
| **Tier 3: Next-level** | Safety-critical, AI-native, or agent-operated | Formal specs/model checking (TLA+, proof assistants) for core invariants; MC/DC where required; differential & metamorphic tests; deterministic simulation testing; predictive test selection with measured recall; SLSA Source L3+ / OIDC; for AI/agents: versioned golden evals, calibrated judge-human agreement, red teaming, pass@k/pass^k, and the Agent-Integrity controls below | Versioned eval datasets + measured judge-human agreement; agent test edits blocked or separately approved; completion claims machine-verified against evidence bundles; contamination checks before trusting scores |

Standards anchors: ISO/IEC/IEEE 29119 (parts 1-5), ISO/IEC TS 42119-2:2025 (AI
testing), NIST SSDF SP 800-218 (v1.1 final, v1.2 draft) & SP 800-218A, SLSA
v1.2 (Build + Source tracks), and EU AI Act (high-risk timelines moved by Reg.
(EU) 2026/1744 to Dec 2027 / Aug 2028).

## 2. Tiered, Budgeted Verification (V0 -> V3)

Every verification tier has a **compute budget** and a **token budget**. Work
moves up a tier only after the cheaper tier passes.

| Tier | Where | Target budget | What runs |
| --- | --- | --- | --- |
| **V0: Inner loop** | Local sandbox / laptop | <30 s, <1.5k tokens into context | Format, lint, typecheck on changed files; affected unit tests only |
| **V1: Pre-push / PR check** | Local gate or cheap CI | <10 min | Path filters; affected tests via build graph/changed files; cache; cancel superseded runs; SHA-pinned actions; `permissions: contents: read` |
| **V2: Merge / private CI** | Merge queue or private runner | <30 min amortized | Full affected + integration + contract tests; batching + auto-bisect on failure |
| **V3: Post-merge / nightly** | Scheduled / bulk runner | Scheduled | Full suite, fuzzing, mutation sampling, flaky reruns, E2E, perf benchmarks |

Respect host/user CI policy: where cloud CI is forbidden or unwanted, map V0/V1
to a fast local Bun/toolchain gate (`ci-test-rebuild`) and V2/V3 to the user's
private CI box or scheduled runners.

## 3. Token-Budgeted Failure Digests & Prompt-Cache Hygiene

Local test cost is driven mainly by **context re-transmission**, not CPU time.
A 2026 study (*Token Reduction Is Not Cost Reduction*, arXiv 2607.12161) found
prompt cache creation + reads drove ~80-87% of billed cost, while naive output
truncation caused agents to re-run commands and *raise* real cost.

Rules when running tests in any cell or wrapper:

1. **Raw logs go to disk; digests enter context.** Redirect full output and
   JUnit/JSON reports to an artifact path and return a compact digest (~1-2k
   tokens): command, exit code, passed/failed counts, deduped failures,
   `log_path`, and hash.
2. **Never truncate assertion messages or final traceback frames.** Cut passing
   noise and repeated stack prefixes; keep the exact assertion diff and tail
   frames so the agent fixes on the first pass instead of re-running.
3. **Keep prompt prefixes stable.** Don't churn top-of-context instructions or
   dump huge variable logs mid-session; track cache-hit rate and verify savings
   on real billed cost, not raw token counts alone.
4. **Use cheap verifiers for noisy triage.** Let a deterministic script or
   small model classify failures and flaky signatures; hand only the digest and
   verdict back to the coordinator.
5. **Protect local machines.** Run V0 locally, cap worker parallelism/RAM when
   contention hurts speed or causes flakiness, and offload V2/V3 heavy suites.

## 4. Agent-Integrity Controls (hardening the tester-vs-tested seam)

Evidence from 2025-2026 shows agents exploit writable tests (ImpossibleBench;
METR RE-Bench), overstate completion (Yang et al. 2026: 37.24% of sampled work
reports had >=1 unfaithful claim), and detect evaluation framing (Needham et
al. 2025). Apply the operational controls below according to risk tier:

| Control | Status | How max-build applies it |
| --- | --- | --- |
| **Sealed Oracles** | Emerging / operationalized | Never weaken, skip, or silently alter existing tests or graders to make a check pass. Any diff to test/oracle files is an explicit claim that needs its own justification and red->green proof; in CI, guard test paths via CODEOWNERS, read-only mounts, or hidden held-out splits. |
| **Pre-Registered Acceptance** | Proposed | Freeze C# checks and S# scenarios in the ledger *before* mutating code. Mid-run changes to acceptance require an explicit amendment row in Decisions — never quiet scope drift. |
| **Evidence-Carrying Completion (ECC)** | Proposed (in-toto style) | Emit "VERIFIED" only from observed execution receipts (exact command, exit code, git tree/commit state, artifact paths). Build the report *from* receipts, never prose-first. |
| **Claim-Trace Differential Audit** | Emerging -> blocking gate | Before final delivery, verify every atomic claim ("added X", "all tests pass", "reduced Y%") against actual tool output and diff ([audit.md](audit.md)). |
| **Grader / Oracle Mutation Testing** | Emerging -> CI gate | Treat tests and graders as code under test: confirm the test fails on unfixed code or an isolated mutant, and always restore mutated files cleanly between mutants. |
| **Verification Budget Contracts** | Proposed | State compute/token bounds per tier; escalate to heavier suites only on risk or after cheaper tiers pass. |
| **Flaky Quarantine & Stochastic Bounds** | Established | Never "fix" correct code for a flaky failure, and never ignore flakes. Quarantine with an owner and expiry; rerun-on-fail only for known flakes. For LLM/non-deterministic outputs, report `pass@k`/`pass^k` and sample size, not a single lucky run. |
| **Tier-3 Frontier Controls** *(for AI/agent products & evals)* | Emerging / proposed | **Impossible-Task Canaries** (seed ~1% subtly conflicting repo-style tasks in real queues to measure live cheat rate); **Agent Chaos Engineering** (inject silent test skips/truncated logs to verify honest bad-news reporting); **Evaluation-Indistinguishability** (compare eval vs shadow-prod behavior delta); **Asymmetric Certificates** (property/type/formal proofs cheap to check, hard to fake). |

## 5. Ranked CI & Testing Improvement Playbook (Impact vs Effort)

When auditing a repo's CI/test health or writing Core Issues & Next Leverage,
prioritize in this order:

1. **Concurrency `cancel-in-progress: true` + path filters + explicit timeouts** *(High impact, very low effort)* — stops push storms and wasted docs-only runs.
2. **CI supply-chain hardening** *(High security impact, low effort)* — full commit-SHA pinning (after CVE-2025-30066 `tj-actions`), least-privilege `GITHUB_TOKEN`, OIDC over long-lived secrets, approval gates for outside PRs.
3. **Structured failure digests + on-disk logs + cache-friendly layout** *(High impact, low effort)*.
4. **Sealed test/oracle paths** *(High impact, low effort)* — CODEOWNERS / branch rules / read-only test mounts.
5. **Evidence-carrying completion + claim-trace checks** *(High impact, low-medium effort)*.
6. **OSS PR throttles & grouped bot updates** *(High OSS impact, low effort)* — open-PR caps, trust tiers (T0/T1/T2), grouped Dependabot/Renovate.
7. **Flaky quarantine with owner & expiry** *(Medium-high impact, medium effort)* — Google measured ~16% of tests with some flakiness and 84% of pass->fail transitions from flakes.
8. **Affected-only testing from build graph + shared local/CI remote cache** *(Very high impact, medium-high effort)* — Meta's predictive selection caught >99.9% of faulty changes at <1/3 dependency-selected tests, halving test infra cost.
9. **Merge queue with batching & auto-bisect** *(High impact, medium effort)*.
10. **Mutation sampling on critical modules + property/metamorphic tests** *(Medium-high impact, medium effort)* — coverage alone misses weak assertions (Facebook ICSE-SEIP 2021: >50% of 15k+ mutants survived).
11. **Contract tests replacing brittle E2E + hermetic devcontainers** *(Medium impact, medium effort)*.
12. **Private rotating eval sets + judge-human agreement + `pass^k`** *(High AI-product impact, medium effort)* — public benchmarks saturate and break (OpenAI retired SWE-bench Verified in Feb 2026 after finding >=59.4% of audited hard tasks had flawed tests).

## 6. Metrics to Track (never guess savings)

Track: CI minutes per merged PR, queue p50/p95, build & prompt cache hit rate,
selection recall (against periodic full runs), flaky rate per test, tokens &
dollars per successful task, re-run count per task, and verified-completion
rate. Always distinguish measured numbers from estimates, and verify on your
own stack (cheating and cost rates vary heavily by model and harness).
