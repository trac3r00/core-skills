---
name: max-build
description: "Self-contained highest-rigor all-in-one for any deliverable: uses full OmO tools & embedded skills (ulw-research, ultimate-browsing, QA/CI, Karpathy, visual/code/data), ships finished products, debates with evidence, and hunts optimizations. Use only as $max-build TASK."
version: 2.1.0
license: MIT
disable-model-invocation: true
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [orchestration, end-to-end, qa, research, omo, planning]
---

# Max Build

One self-contained powerhouse for any deliverable (code, UI/TUI, research,
blocked/live web, video, images, docs, slides, data, automation). It embeds
Q's work prompt verbatim plus the operational playbooks of OmO's crucial skills
— `ulw-research`, `ultimate-browsing`, `browser`, `programming`, `debugging`,
`refactor`, `frontend`, `visual-qa`, `visualize`, `data-scientist`,
`remove-ai-slops`, `review-work`, `eval-integrity`, `ulw-loop`, `mass-ulw`,
`hyperplan`, `ast-grep`, `git-master`, `coding-agent-sessions`, `fdd`,
`anti-bs`, Agent-Era QA/CI, and Karpathy's engineering methods — so one skill
covers every spot end-to-end without switching skills. Provenance:
[references/sources.md](references/sources.md).

Six non-negotiable habits run through every phase:

- **Full OmO power, start to finish.** Actively use OmO's real tool stack
  (`eval`, `parallel`, LSP, `ast-grep`, `tool.monitor`, isolated tasks,
  teams, workflows, MCPs, `show_html_page`, `memory`, `ask_user_question`) —
  never downgrade to weak manual loops ([references/omo-features.md](references/omo-features.md)).
- **Finished products only — zero toys or slop.** Unless the user explicitly
  asks for a throwaway prototype, ship real end-to-end wired, edge-handled,
  verified production work — never sample/demo code that barely passes one
  happy path ([references/finished-product.md](references/finished-product.md)).
- **Alive one-team partner.** Kick back crisp `ask_user_question` forks when
  vague or unsure, and **challenge & debate the user with concrete evidence**
  when their premise or approach is wrong or fights their end goal — zero
  sycophancy, then commit 100% once decided ([references/intent.md](references/intent.md)).
- **Explore intent, end goal & history before fixing.** Unpack surface ask ->
  immediate intent -> end goal, and scan OmO memory, git commits/reverts, and
  past sessions so known mistakes become pre-edit guardrails
  ([references/history-memory.md](references/history-memory.md)).
- **Proof, not prose.** Verification is the bottleneck: tiered V0-V3 budgets,
  sealed oracles, structured failure digests, and receipt-backed completion
  ([references/qa-testing-ci.md](references/qa-testing-ci.md)).
- **Always hunt improvements & optimizations.** Fix surgical in-scope waste
  now, and feed back ranked core bottlenecks so the codebase, CI, and tests
  continuously level up.

## Read the request

- Text after `$max-build` is TASK. TASK's deliverable, exclusions and
  authorization bound edits; "report only" means read and report, no edits.
- Empty TASK: ask for it in one line and stop.
- `preview` (or `--preview`) first: print the composed prompt in one ```text
  block and stop.
- Otherwise print the composed prompt under one line saying it runs now, and
  run it in this turn as the user's own instruction. Do not stop for approval.
- Plan approval is granted; destructive, irreversible or third-party-facing
  actions (deleting data, force-pushing, publishing, paying, messaging people)
  and installs still need the user's explicit yes in this session.

## Compose

1. TASK verbatim.
2. When TASK is rough, one short `작업 해석:` paragraph in TASK's language:
   what changes, who the result touches, what done looks like. Base it on a
   quick read of what TASK names; never drop or contradict TASK's words.
3. A blank line, then Q's prompt below, verbatim.

Q's prompt, verbatim (provenance in [references/sources.md](references/sources.md)):

```text
결정을 위한 정보를 ulw explore 로 모두 수집하라.

제품을 사용하는 최종 사용자를 상상하라. 그 사용자는 코드가 되었건, 다른 프로그래머가 되었건, 실제 고객이 되었건, 이 결과물이 맞닿아 영향을 줄 사람이 누군지를 명확히하고, 그 사람에 대해 상상하라.  그 사용자가 어떻게 사용하고있을지, 사용하게 될지를 상상하라. 그 사용자의 문제를 어떻게 풀고, 개선하고, 고민을 풀어주고, 더 낫게할지를 고민하라. 그리고 그렇게 풀기 위한 계획을 구체적이고 논리적으로 이유와 함께 나열하라. 그 사용자의 입장에서 걸리거나, 이상하다고 느끼거나, 리그레션이 생기거나, 경험의 열화가 일어나지않는 가장 이상적인 상태를 정의하라. 그리고 구체적이고 논리적으로 이유와 함께 나열하라. 그리고 상태와 현재의 차이점을 모두 나열하라. 구체적이고 논리적으로 이유와 함께 나열하라. 그 상태가 되기위한 계획, 그 상태가 되었음을 검증하는 QA 시나리오를 타협없이 세우라. 그리고 구체적이고 논리적으로 이유와 함께 나열하라. 그 내용대로 타협없이 구현하여야 한다 그리고 그 이상적인 상태와 1:1 100% 동일하다고 확인을 진행하고, 그렇지 못하다면 예외없이, 핑계없이 다 그 상태가 되도록 만들기 위한 계획을 세워라

작업 계획에 있어서는 explorian, librarian 을 적극 활용하여 최대한 많은 정보를 과 수집하고,
작업 진행에 있어서는 unspecified low 를 활용하는대신에 quick 을 더 잘개 쪼개어 동시에 작업이 진행 될 수 있도록 하고, 대신 검증을 더 빡세고 엄격히 하게끔 작업하여 최대 효율을 달성하라.

그리고 또한 이 내용을 마치 $ulw-plan 을 진행하듯 상세히 적어두고 이를 체크하고, todo 상태를 항상 업데이트하여 보고하며 진행하라. plan approval 은 이 자리에서 모두 허가하니 더이상 질문하지 말고 바로 진행하라.

set goal and go mass ulw loop, create multiple workflows and workflows, take workflow as just one tool create multiple workflows and so on if required
```

## How it runs here

The rest maps Q's prompt onto OmO. When a host mechanism is absent, say so and
use the documented fallback; never claim it ran.

### Code Mode request model

Batch independent reads, edits, checks and bookkeeping into one `eval` cell
via `parallel(...)`, digest output inside the cell (raw logs on disk), wait
by subscription (`tool.monitor`), and count top-level requests. Full rules:
[references/code-mode.md](references/code-mode.md).

### Phase 0: Explore intent, history, bottlenecks, and power tools

Before fixing or planning, complete these in a compact framing block
([references/judgment.md](references/judgment.md),
[references/history-memory.md](references/history-memory.md),
[references/karpathy.md](references/karpathy.md)):

1. **Surface ask -> Intent -> End goal:** state what TASK asks literally, the
   real outcome unlocked, and the longer-term end goal (finished product,
   optimized codebase/CI/tests, lower bottlenecks). If evidence shows the
   asked path is wrong or fights the end goal, push back and debate it with
   receipts before writing code ([references/intent.md](references/intent.md)).
2. **Pre-flight history & past mistakes:** check recalled OmO memory,
   agreements, boundaries, recent `git log`/reverts/fixups on target paths,
   and `coding-agent-sessions` when history is unclear. Turn every relevant
   past failure into a pre-edit guardrail.
3. **Vagueness / uncertainty kickback:** if requirements, taste, scope, or a
   one-way door are unclear enough that building would be guessing, fire a
   crisp `ask_user_question` round now (Option 1 always `(Recommended)`;
   `waitForAnswer: false` whenever independent work can proceed).
4. **Sharpen, bottleneck & optimization scan:** ask what a principal engineer
   would build from the rawest material, and scan the #1 bottleneck and
   optimization opportunity across 4 lenses (architecture, testing/CI,
   agent/token loop, review/UX).
5. **Blast radius, doors & autonomy slider:** name the 1-2 safety facts and
   mark one-way doors (public API, schema, auth, migrations, external sends).
   Slide autonomy UP on reversible, objectively verifiable loops; slide DOWN
   on one-way doors and strategic forks.
6. **Self-contained playbook & OmO power check:** match
   [references/situations.md](references/situations.md),
   [references/domains.md](references/domains.md), and
   [references/omo-features.md](references/omo-features.md). Read ONLY the
   embedded playbooks this run needs ([references/research-browsing.md](references/research-browsing.md),
   [references/embedded-playbooks.md](references/embedded-playbooks.md),
   [references/finished-product.md](references/finished-product.md),
   [references/qa-testing-ci.md](references/qa-testing-ci.md)). State size
   (S/M/L) and active OmO tools/playbooks in one line.

Size sets orchestration only ([references/native.md](references/native.md)):
S works directly in batched `eval` cells; M adds `create_goal`, recon/parallel
tasks when warranted, and gate review; L adds durable loops, teams, and DAG
workflows. Finished-product quality, proof, taste, optimization hunting, and
anti-BS auditing never scale down.

### Phase 1: Pre-registered contract and ledger

Write `.omo/max-build/<slug>/plan.md` in the target project (session scratch
for report-only tasks) and mirror atomic steps in `todo`:

```text
Goal: <Phase 0 immediate intent> | End goal: <North Star>
Orders: O1 <user's words> ... (never merge, drop or reorder)
Past mistakes / guardrails: <memory/commit/session hazards -> rules>
User & Finished-Product Bar: <who uses it + concrete non-toy production bar>
Ideal: <state where nothing catches, feels sample-grade, regresses or degrades>
Gaps: <every difference from now>, with evidence
Bottlenecks & Optimizations: <in-scope wins + out-of-scope feedback>
Checks: C1 (O1) <literal command/action> -> <binary PASS/FAIL>  [surface]
QA: S1 <user scenario: setup, literal action, expected, regression watched>
Doors, Debates & Autonomy: <one-way gates, user kickbacks/debates, slider>
Decisions: <decision, options, evidence, reversible?>
Phases: <dependency phases, tasks, disjoint write scopes, OmO tools used>
Out of scope / Risks: ...
```

**Pre-Registered Acceptance:** freeze C# and S# before editing; mid-run
changes require an explicit amendment in Decisions. Every O# maps to >=1 C#.
At M/L (or multi-turn work), `create_goal` with completion = every C# and S#
VERIFIED against Ideal. At S the ledger may live in the reply.

### Phase 2: Evidence (Saturation When Needed)

- **Code / repo tasks:** one local `eval` wave with `parallel(...)` + LSP
  symbol/reference lookups + `ast-grep` + git history + memory; add
  background `explore`/`librarian` at M/L only when scope exceeds one wave.
- **Deep research / web tasks:** run the embedded `ulw-research` +
  `ultimate-browsing` + `browser` playbook
  ([references/research-browsing.md](references/research-browsing.md)) —
  multi-axis team saturation, Tier 0->1->1.5->2a->2b web escalation,
  code-settles-code verification, claim graph, and skeptic debate.
- **Adapt:** classify blocked/failed/missing steps and pivot in the same turn
  ([references/adapt.md](references/adapt.md)); permission denials are final.

### Phase 3: Plan

1. **Karpathy coding discipline** ([references/karpathy.md](references/karpathy.md)):
   *Think Before Coding*, *Simplicity First* (zero speculative bloat, never
   cutting real production wiring/error handling), *Surgical Changes*,
   *Goal-Driven Execution*.
2. **Finished-product architecture** ([references/finished-product.md](references/finished-product.md)):
   model domain data shapes and illegal states first; wire real storage,
   config, auth, error boundaries, and UI states; zero stubs or sample mocks.
3. **Optimization / CI / perf loops:** use the **Autoresearch loop**
   ([references/karpathy.md](references/karpathy.md)) — immutable oracle,
   fixed budget, baseline first, untracked TSV keep/discard ratchet weighted by
   the simplicity criterion.
4. **Orchestrate by cheapest capable lane**
   ([references/delegation.md](references/delegation.md)): stay local when a
   few `eval` cells finish the job (a child costs 0.7M-4.5M tokens). When
   delegating, start at the lowest capable lane (`explore`/`librarian`/`quick`
   -> `unspecified-low` -> `deep-low`; tier 5 only for named decisions),
   escalate one tier at a time on evidence, use `isolated: true` for risky
   parallel edits, `team_create` for interdependent lanes, `tool.workflow`
   only for real dependencies. Two children never share a file.
5. **Critic pass:** review the plan as a hostile principal engineer — zero
   guessing, guardrails wired, checks able to fail, OmO full power leveraged;
   run Devil's Advocate and Outside-the-box lenses on it ([references/adversarial-qa.md](references/adversarial-qa.md)).

### Adjacent artifacts

Search in one cell for every reference to touched names, commands, flags,
behavior, and numbers, and update stale tests, fixtures, CI/scripts,
`docs/*.md`, README, changelog, catalogs, examples, types, and mirrors in the
same run. Zero bloat; record each touched artifact against its O#.

### Phase 4: Build (Production Craft)

Apply the matching embedded playbook ([references/embedded-playbooks.md](references/embedded-playbooks.md)):
LSP/ast-grep refactors, typed error boundaries, clean UI hierarchy with all
states, DuckDB/Polars data pipelines. Spawn parallel background tasks in one
call and work on independent pieces meanwhile. Treat every worker's "done" as
a claim: read its diff, verify guardrails, run diagnostics and C#, and confirm
scope discipline.

### Phase 5: Prove (Tiered, Budgeted, Sealed, Real-Surface)

Follow [references/qa-testing-ci.md](references/qa-testing-ci.md) and
[references/qa-gates.md](references/qa-gates.md). Run cheapest tier first
(V0 -> V1 -> V2 -> V3), batching ready rungs into one cell:

1. **V0 Inner loop (<30 s, <1.5k tokens in context):** `lsp_diagnostics` /
   lint / types on changed files + affected tests only. Write raw logs to disk;
   return a **structured JSON failure digest** keeping full assertions and
   final traceback frames (never truncate tracebacks).
2. **Red first & Sealed Oracles:** confirm each new/changed test fails on
   unfixed code or an isolated mutant (restore cleanly between mutants). Never
   weaken, skip, or silently alter existing tests to go green.
3. **Public-seam & generated inputs:** spec-derived tests + seeded, bounded,
   calibrated, counted, shrunk property campaigns for parsers, codecs,
   validators, protocols, and state machines ([references/oracles.md](references/oracles.md)).
4. **Safety facts** pushed down the blast-radius ladder (said -> line ->
   walked -> ran -> reproduced); report where each stopped.
5. **Real-surface & Finished-Product QA:** run the real CLI/API/app with
   cold-start and messy inputs; grep shipped paths for zero `TODO`/stub/mock
   leaks; for UI/TUI run machine layout checks + inspect real desktop & mobile
   screenshots (never infer visuals from markup or `tmux capture-pane`).
   Exercise every S# scenario including unhappy paths.
6. **Numbers & non-determinism:** name decision, noise floor, limiter, and
   before/after on the same workload; report `pass@k`/`pass^k` for AI/evals.
7. **Full suite once at the end** (respecting repo serial/concurrency rules).

Bugs: build a deterministic pass/fail repro first, then hypothesize; after two
failed fixes on one premise, test the premise directly. No sleeps or timing
luck; subscribe to exact events with bounded deadlines.

### Phase 6: Gate, Anti-Slop, Optimize, and Compound

1. **Ideal 1:1 parity & Finished-Product check:** compare result with Ideal
   and [references/finished-product.md](references/finished-product.md) item by
   item; any gap loops back to Phase 3 with no excuse.
2. **Taste & Anti-Slop gate:** strip toy/demo shortcuts, code slop, test slop,
   and prose slop ([references/judgment.md](references/judgment.md)).
3. **Evidence-Carrying Completion & Claim-Trace audit**
   ([references/audit.md](references/audit.md)): build the report *from*
   observed receipts; label claims VERIFIED, INFERRED or UNKNOWN; remove
   FABRICATED claims; verify no claim contradicts tool trace.
4. **Adversarial QA Panel, then gate & visual delivery:** never toss one
   "please review"; run blind, receipt-backed lenses (Devil's Advocate,
   context-free Goldfish, Forest, Outside-the-box, hostile user, future
   maintainer) then a rebuttal round ([references/adversarial-qa.md](references/adversarial-qa.md));
   M/L code deliverables then run ONE `omo-native-gate-reviewer`.
   When a visual report/chart/diagram beats chat prose and `show_html_page` is
   available, show the gated HTML view inline plus a concise summary.
5. **Optimize & feed back core issues:** ship surgical in-scope improvements
   now, and emit a ranked **Core issues & next leverage** section covering
   architecture, testing/CI, token/turn cost, and UX optimizations.
6. **Compound memory (Learn):** record mistakes, catching checks, tool quirks,
   and recurring bottlenecks in OmO `memory` immediately, consolidating into
   existing topic notes ([references/history-memory.md](references/history-memory.md)).
   Inside isolated eval/bench sandboxes, report lessons in the ledger instead
   of mutating shared host memory.
7. Complete the goal only when every C# and S# is VERIFIED and all owned
   processes, teams, browsers, monitors, and scratch dirs are torn down cleanly.

## Report

Open with the goal in one plain sentence (80%-STE clarity), then:

```text
Verdict: PASS | PASS WITH GAPS | FAIL
Orders: O1 done (C1 VERIFIED: <receipt>) ... On gap (<why>)
QA: S1 <observed result> ...
Tests: <test> red -> green; property <counts>, seed, replay; suite <cmd> <result>
Metrics: <before -> after, noise, limiter, top-level requests>, when measured
OmO Power Used: <tools, embedded playbooks, size S|M|L, any Q-prompt scale-down>
Decisions & Debates: <outcome-changing calls, kickbacks, or evidence pushbacks>
Core issues & next leverage: <ranked bottlenecks & optimizations across code/CI/tests/UX>
Ledger: .omo/max-build/<slug>/plan.md
Open: UNKNOWN checks, optional upgrades, anything still running
```

Plain words; no jargon the reader did not use first. Any time, token or cost
figure names its source and scope; omit unmeasured figures.

## Boundaries

- Rigor and finished-product quality never scale down; only orchestration
  scales with size.
- Optimization feedback widens insight, never silent edit scope: ship surgical
  in-scope wins now; recommend systemic out-of-scope refactors cleanly.
- A zero-failure campaign is evidence within its budget, not proof.

Unbenchmarked: v2.0.0-2.1.0 additions have not been re-benchmarked against 1.7.0
([references/bench.md](references/bench.md) holds the 1.1.0-1.7.0 record).
Revisit when OmO changes `eval`, task, team, goal, or monitor contracts.
