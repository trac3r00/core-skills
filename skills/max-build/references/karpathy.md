# Karpathy Engineering Methods for Agentic Work

Read in Phase 0/3 for coding discipline, optimization/CI/eval loops, and
calibration of human-agent autonomy. Distilled from Andrej Karpathy's public
engineering notes and primary repos (2025-2026); see [sources.md](sources.md)
for exact provenance.

Core shift: LLMs generate faster than humans can verify, and they loop well
when given objective success criteria. The craft is **thinking before editing,
keeping diffs surgical and simple, tightening the generation-verification loop,
and running disciplined keep/discard experiments.**

## 1. Four Coding Pitfall Defenses (every code change)

Derived from Karpathy's Jan 26, 2026 observations on LLM coding failure modes
(and Forrest Chang's `andrej-karpathy-skills` distillation):

1. **Think Before Coding — surface assumptions, confusion, and tradeoffs.**
   - State non-obvious assumptions explicitly in Phase 0/1; never silently pick
     one interpretation and charge ahead when readings diverge materially.
   - Surface inconsistencies in specs, docs, or existing code early.
   - Push back constructively once when a simpler or structurally better path
     meets the user's end goal with less complexity.
2. **Simplicity First — minimum code that solves the problem.**
   - No speculative abstractions, single-use helper wrappers, unrequested
     config knobs, or defensive error handling for impossible internal states.
   - Test: *Would a principal engineer call this overcomplicated? If 200 lines
     can be 50 with equal clarity, rewrite it.*
3. **Surgical Changes — touch only what serves the goal.**
   - Every changed line must trace to an Order (`O#`) or an adjacent artifact
     the change directly made stale.
   - Match existing local style even if you would write it differently.
   - Remove imports, helpers, and dead branches *your* edits orphaned; report
     unrelated pre-existing rot under **Core Issues & Next Leverage** rather
     than doing unrequested drive-by rewrites (unless cleanup is in scope).
4. **Goal-Driven Execution — verifiable success criteria over micro-steps.**
   - Convert imperative asks into machine-checkable goals before editing:
     - "Add validation" -> write invalid-input tests, then make them pass.
     - "Fix the bug" -> write the failing repro test, then make it pass.
     - "Refactor X" -> lock existing public-seam tests green before and after.
   - Strong criteria let OmO loop autonomously; vague criteria ("make it
     better") force guessing and slop.

## 2. The Autoresearch Loop (for optimization, CI speedup, perf, evals)

From `karpathy/autoresearch/program.md` (March 2026). Use this whenever the
goal is measurable hill-climbing (faster CI/tests, lower token/memory cost,
better benchmark/eval score, throughput/latency tuning):

1. **Separate immutable oracle from mutable target.** Lock the benchmark,
   scorer, or test harness read-only (Sealed Oracle) and change only the target
   under optimization. Never touch the metric code to inflate numbers.
2. **Baseline first under a fixed budget.** Run the unmodified target first
   with a fixed time/iteration budget and a hard timeout kill. Record baseline.
3. **Log every trial in an untracked TSV ratchet** (e.g. under the task's
   evidence dir):
   `commit_or_id \t primary_metric \t resource_cost \t status(keep|discard|crash) \t description`
4. **Keep/discard ratchet with the Simplicity Criterion:**
   - Better metric + clean code -> **keep** (advance state/commit).
   - Equal or worse metric -> **discard** (revert cleanly to last kept state).
   - Tiny metric gain that adds ugly complexity -> **discard**.
   - Equal metric (or tiny gain) achieved by **deleting** code/complexity ->
     **definitely keep** (simplification win).
   - Crash: fix trivial typos once; if the idea is broken, log `crash`,
     revert, and move on.
5. **Context-clean execution.** Redirect verbose logs to disk (`> run.log 2>&1`),
   extract only the metric summary line into context, and inspect `tail -n 50`
   only on crash.
6. **Autonomous endurance.** Once baseline, budget, immutable oracle, and
   reversible ratchet are set, iterate continuously — synthesizing from prior
   near-misses — until the target or budget is reached, without pausing to ask
   "should I keep going?".

## 3. Generation-Verification Loop & Autonomy Slider ("Iron Man Suit")

From Karpathy's *Software Is Changing (Again)* (YC AI Startup School, 2025)
and his precision-output notes (X, 2026-10-02):

- **Optimize for verification speed.** Keep diffs small, scoped, and easy to
  audit; pair every claim with runnable proof; write reports in crisp 80%-STE
  precision prose and escalate to diagrams/interactive views only when prose
  cannot carry the structure (see installed `karpathy-prompt` skill).
- **Slide autonomy intentionally:**
  - **Slide UP (near-autonomous Jarvis mode):** objective oracle, fast checks,
    reversible two-way doors, authorized scope -> explore, execute, verify,
    fix, and report cleanly without micro-interruptions.
  - **Slide DOWN (collaborative partner mode):** one-way doors (schemas, public
    APIs, migrations, external/destructive actions), ambiguous product taste,
    or strategic trade-offs -> surface the tradeoff crisply with a recommended
    option before committing.
- **Compound knowledge across runs (LLM Wiki):** distill recurring architecture
  facts, bottlenecks, and failed experiments into structured OmO memory notes
  ([history-memory.md](history-memory.md)) so each session starts smarter than
  the last.
