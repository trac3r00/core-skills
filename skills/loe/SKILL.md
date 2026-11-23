---
name: loe
description: "Define LoE (Level of Expectation): observable outcomes, scope, and evidence of done. Use for acceptance criteria before work. Not for task plans (ulw-plan)."
version: 0.1.2
license: MIT
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [acceptance-criteria, planning, scope, requirements]
---

# LoE - Level of Expectation

Agree on what must be true, not how impressive the implementation should look.
LoE means Level of Expectation here, not level of effort.

## Inputs and output

Use the current request, target project, relevant roadmap or manifesto, existing
`Rules.md`, applicable `AGENTS.md`, README, and any existing acceptance criteria.
Discover actual filename casing; do not create parallel case variants.
Read the relevant sections before treating them as requirements.

Produce a concise expectation contract in the reply. When a durable project
artifact is requested, update the existing acceptance document or write
`docs/expectations/<task-slug>.md`. Do not create files merely to run this skill.
This skill defines acceptance; it does not begin implementation.

## Build the contract

1. Identify the user and the job they need to finish. State the desired outcome
   in one sentence and connect it to the current roadmap milestone or goal.
   Explicit requests can authorize work outside the roadmap; record that
   decision rather than secretly rewriting the roadmap.
2. Inspect the current behavior and constraints. Separate explicit requirements,
   observed repository facts, reasonable assumptions, and unresolved decisions.
   Do not promote an inferred preference into a mandatory policy.
3. Define the smallest complete result. Name included behavior, excluded behavior,
   compatibility obligations, and what must remain intact. No new architecture,
   dependency, visual polish, or extra feature earns credit without a requirement.
4. Give each required outcome a stable `EXP-###` ID. Specify starting state,
   concrete action/input, binary observable result, and evidence channel.
   Include relevant failure/recovery behavior, not just the happy path.
5. Record applicable quality constraints with values from the user or project:
   latency, resource limits, accessibility, data integrity, supported platforms,
   reliability, privacy, or maintainability. Do not invent numeric thresholds.
   If a threshold matters but has no source, label it proposed or unresolved.
6. Ask only about uncertainty that changes acceptance (`ask_user_question`).
   Continue independent work; mark affected outcomes blocked instead of
   choosing an answer invisibly.
   Existing user decisions need no ritual reapproval.
7. Check that every MUST has a verifier and every planned deliverable has an
   outcome. Remove unneeded deliverables, not inconvenient requirements.

## Contract shape

```text
Outcome / intended user:
Goal or milestone / source:
In scope:
Out of scope:
Constraints and compatibility:

ID | Requirement and source | Starting state + action | Pass observable | Evidence
EXP-001 | ... | ... | ... | ...

Assumptions:
Open decisions and affected IDs:
Done when:
```

Use plain requirements rather than arbitrary bronze/silver/gold tiers.
Distinguish required outcomes from optional suggestions. A source pointer should
identify a real file and section, or the user's decision.

## Verification and recovery

Walk each criterion as a reviewer: could the implementation satisfy it while
failing the user's actual job? Name a plausible wrong result it must reject;
if it cannot distinguish that result, strengthen the observable, not the prose.
Tighten criteria that only inspect internal structure, count tests, or accept
a screenshot without the needed behavior.
Example: a CSV export is done when the intended user can export, reopen, and
recover the expected records, not when an Export button exists.

If sources conflict, report the exact conflict and apply the host's instruction
priority. Repository files do not override current user instructions. Carry
unresolved product choices forward visibly; do not call the contract agreed
when the user has not made a necessary decision.

## Finish and handoff

Return the contract, sources read, unresolved IDs, and the exact stop condition.
Stop once the expectation contract is complete or its missing decisions are
identified. FDD may test invariants, DFT may prove real journeys, and Preflight
may enforce release criteria later; do not invoke them recursively.

Invoke in OmO: `/skill:loe <task>` or `$loe <task>`.
Example: `$loe define expectations for offline invoice export`.
A request to estimate implementation hours alone is a near miss.

Unbenchmarked. Revisit when acceptance escapes are found or routing changes.
