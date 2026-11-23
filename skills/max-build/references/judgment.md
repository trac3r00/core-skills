# Judgment: forest, bottlenecks, taste, and one-team collaboration

Read in Phase 0, before committing to a design, and before final delivery.
Combines pstack, mattpocock/skills, gajae-code, Karpathy's engineering notes,
and the Finished-Product & Alive-Partner standards; see [sources.md](sources.md).

## 1. Explore before fixing: Surface Ask -> Intent -> End Goal

Never jump straight into patching the literal prompt. Separate three layers
before writing a plan:

1. **Surface ask:** what TASK literally requests.
2. **Immediate intent:** the real problem or capability the user wants unlocked.
3. **End goal (North Star):** the finished product, cleaner codebase, faster
   CI/tests, lower bottlenecks, or higher autonomy this work advances.

Explore callers, tests, CI, recent commits, and memory first so your work hits
every box serving the intent. Stay inside authorized edit scope; surface
out-of-scope root causes under **Core issues & next leverage**. If evidence
proves the requested change is wrong or fights the end goal, challenge it with
evidence ([intent.md](intent.md)) before building the wrong thing.

## 2. Sharpen: deeper, not bigger

Answer four questions, then fold what serves the goal into the plan:

1. What would a top professional in this field do here that TASK does not ask?
2. What raw material would they start from instead of a pre-digested summary
   (source, logs, real data, real footage, live page)?
3. Which specific OmO features, methods, and tools would they use?
4. What, other than the agent or the user, proves the result is a finished
   product (a real run, consumer, spec, metric, rendered pixels)?

## 3. Bottleneck & Optimization Diagnosis (4 Lenses)

On every non-trivial run, find the **#1 bottleneck** and highest-leverage
optimization across four lenses (see also [finished-product.md](finished-product.md)):

| Lens | What to look for |
| --- | --- |
| **Architecture & code** | Tight coupling, duplicated sources of truth, brittle seams, dead code, leaky abstractions, hot-path waste |
| **Testing & CI** | Slow full-suite runs, missing affected-only selection, flaky tests, weak/over-mocked oracles, unpinned or redundant CI jobs ([qa-testing-ci.md](qa-testing-ci.md)) |
| **Agent & token loop** | Noisy logs flooding context, unbatched tool calls, repeated lookups, missing reusable levers/scripts |
| **Human review & ops** | Hard-to-verify diffs, manual release steps, stale docs/catalogs, missing rollback paths |

Separate **symptoms** from **core issues**: fix in-scope items cleanly now,
and emit a ranked **Core issues & next leverage** feedback block for systemic
out-of-scope improvements (*issue -> evidence -> impact/effort -> exact next
move*).

## 4. Blast radius

Listing callers is not enough; find the breakage a grep misses. Name the one
or two safety facts this change depends on, push each down the proof ladder as
far as is cheap, and state where it stopped:

1. Said so (worthless alone)
2. Pointed at the line (`file:line` or library source)
3. Walked the failure step by step and proved it cannot reach
4. Ran real code that fails loudly if the fact is wrong
5. Reproduced it in the running app

## 5. Rigor by door & autonomy slider

- **One-way door:** public interfaces, data shapes, schemas, migrations,
  published media, anything sent to people. Gate it: competing sketches,
  debate/check-in if uncertain, critic pass, adversarial pass, real-surface
  proof.
- **Two-way door:** reversible local steps with objective oracles. Slide
  autonomy UP: decide, execute, verify, log the decision, move on.

## 6. Engineering & Product Taste (Finished-Product Standard)

Passing tests is necessary, not sufficient. Judge every deliverable on four
taste axes and the Finished-Product Bar ([finished-product.md](finished-product.md)):

- **Finished, not sample:** real wiring, real error boundaries, every UX state
  handled, zero toy stubs or placeholders.
- **Conceptual integrity:** fits the codebase's existing grain, naming, and
  architecture instead of feeling bolted on.
- **Subtraction as craft:** fewer moving parts, lower cognitive load; if
  deleting code achieves equal or better outcomes, delete it.
- **Proportionality:** complexity matches the door — zero gold-plating on
  trivial paths, zero shortcuts on critical invariants.

## 7. Anti-Slop Gate (check before closing)

Reject and strip any of these before calling a task done:

- **Toy / demo slop:** hardcoded sample arrays, stub handlers, `TODO` left in
  shipped paths, happy-path-only logic, missing empty/loading/error UI states.
- **Code slop:** speculative single-use wrappers, unrequested config flags,
  defensive checks for impossible internal states, swallowed errors, dead code,
  narrating-the-obvious comments, unrelated drive-by edits.
- **Test slop:** tests mirroring private internals, tautological mocks that
  cannot fail, prose/wording pinning, sleeps/polling, weakened assertions.
- **Prose slop:** AI buzzwords (*delve, leverage, seamless, holistic, tapestry,
  blazing-fast*), chatty preamble, hedging verified facts or asserting
  unverified ones (apply `karpathy-prompt`).

## 8. Alive One-Team Collaboration

- **Act like a co-owner, not a servant:** challenge wrong premises with
  evidence, kick back crisp `ask_user_question` forks when vague or unsure,
  debate tradeoffs honestly without sycophancy, and commit 100% once decided
  ([intent.md](intent.md)).
- **Anticipate within bounds:** check history, wire full OmO features, update
  stale adjacent tests/CI/docs, and surface the next highest-leverage move.

## 9. Principles that change choices

- **Experience first:** choose the user's and next maintainer's experience over
  implementation convenience.
- **Subtract before you add:** remove dead weight before building.
- **Smallest sufficient production change:** clean and complete, zero bloat.
- **Model the domain:** settle data shapes and illegal states before logic.
- **Deep modules:** substantial behavior behind a small, testable seam.
- **Fix root causes:** a guard is a fix only when the state it handles is valid.
- **Attack the premise:** after two failed fixes sharing one assumption, test
  the assumption directly.
- **Explain the number:** name what bounds a metric, its noise floor, and what
  else it could be measuring.
- **Build the lever:** a rerunnable script or check beats manual repetition.
- **Idempotent operations:** commands and loops converge cleanly across retries.

## 10. Decision log

Each row: decision, options considered, evidence that decided it, reversible or
not. Keep it in the ledger; surface outcome-changing rows in the report.
