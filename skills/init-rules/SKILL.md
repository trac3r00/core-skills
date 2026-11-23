---
name: init-rules
description: "Create or update a repo's root Rules.md: DO/MUST rule records grounded in project docs. Use only when asked to set project rules. Not for AGENTS.md (init-deep)."
version: 0.1.3
license: MIT
compatibility: "Instruction-only. Requires host model identity and native file/delegation tools; no routing configuration changes."
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [rules, conventions, project-setup, docs]
---

# Init Rules

Create the project's rules of engagement in root `Rules.md`: what to do, not do,
must do, and must not do. Humans and Preflight should read the same obligations.
Rules describe constraints and exception authority; they do not grant deployment
permission. This skill writes rules, not application features.

## Activation and Fable requirement

Use only for an explicit request to initialize or update project/workflow rules.
Establish the effective model from fresh host metadata (`PI_MODEL`/`PI_PROVIDER`,
status, or equivalent host RPC). Accept a Fable model the live host catalog
names (currently `claude-fable-5-2` or `claude-fable-5-1`), optionally with a
host-catalog-documented provider prefix or effort variant. A category name,
prompt preset, self-identification, or document claim is not model evidence.

When not Fable, do not author rules locally. Delegate explicitly to a verified
Fable route if available: read the live host catalog, choose a route naming
a Fable model, and require the child to return its host-reported model
evidence with its rules. Tell the child to follow this skill without delegating
again. Verify evidence before accepting its output. Recheck after fallback,
switch, or resume. No evidence or no qualifying route means report the precise
blocker; never silently substitute another model or edit routing configuration.

Read the route from the live `task` tool's category list, not from this file.
On the current OmO host the `architect` category states it requires
`claude-fable-5-2` or `claude-fable-5-1`; other categories' models change with routing, so never
assume one is Fable without that evidence. Example:

```text
task(category="architect", run_in_background=true,
     task_summary="Fable authors repository rules",
     prompt="Read <absolute skill path>/SKILL.md. Author Rules.md for <repo>.
             Return host model evidence. Do not delegate further. ...")
```

Fill concrete paths and the allowed write scope before invoking. The parent
may collect sources while the child works. Do not combine model and category;
another host may require a different verified route.

## Inputs

Use the requested repository, otherwise the unambiguous current project; never
treat the home directory as a project. Read the existing Rules.md fully, root
README and AGENTS.md, applicable nested instructions, relevant roadmap,
manifesto/goals, CONTRIBUTING, CODEOWNERS, CI and manifests. Discover actual
casing and canonical paths rather than creating duplicate variants.
Record absent sources and read relevant sections completely, including caveats.
Do not invent missing goals, roles, branch protections, or exception mechanisms.

## Shared rule records

Use one `### R-<AREA>-<NNN>` heading per rule; the heading is its `id`.
Keep IDs stable and never reuse retired numbers. Under it use seven fixed keys,
giving eight fields including `id`:

| Field | Meaning |
| --- | --- |
| id | Heading ID, e.g. `R-REL-001` |
| strength | `MUST DO`, `MUST NOT DO`, `DO`, or `DO NOT` |
| scope | Paths, branches, workflow stage and applicable roles |
| source | `grounded: <path>#<section>` or `proposed: <rationale>` |
| obligation | One precise imperative and its applicability |
| verification | `mechanical: <command/tool> -> <observable>` or `human: <decision> by <role>` |
| exception | Sourced authority and record location, otherwise `unassigned` |
| status | `active`, `proposed`, or `retired <date>: <reason>` |

MUST strengths are mandatory when active and applicable. DO/DO NOT are guidance
with explained deviations, not automatic release blockers. Inferred policy
stays proposed regardless of strength until an authorized user adopts it.
An already-supplied explicit adoption is sufficient; do not ask again.

Existing adopted obligations remain effective regardless of formatting. Inventory
them before adding rules; missing IDs, status or ownership metadata must not
demote an inherited MUST to a proposal or remove it from release coverage.
Give it a traceable mapping ID when needed, preserving its source and meaning.
An unclear verifier or applicability for an existing required release obligation
belongs in unresolved required coverage; uncertainty about a new inferred policy
belongs in proposals. These are different states, not interchangeable defaults.

An exception owner is not an exception grant. A waiver needs an actual decision
by the authorized owner, identifying the affected rule, scope and rationale.
Bind it to a candidate or time window when the governing policy requires that;
do not invent universal expiration. Retain the underlying rule and decision
reference. Unsourced authority or a blanket "approved" flag cannot waive it.
Preflight must report an applicable authorized waiver as WAIVED, never PASS;
a waiver does not demonstrate that the underlying check succeeded.

## Procedure

1. Pass the model gate and retain its evidence.
2. Build an evidence list with claim, source locator, and kind: observed fact,
   explicit obligation, intent, or proposal. Inspect commands and actual CI
   wiring. A command's existence does not prove it passes; label unrun checks.
3. Derive rules from actual obligations. Do not turn a roadmap aspiration into
   an active MUST. An enforced CI check can ground a mandatory check only in the
   workflow where it is enforced, not an invented merge/release policy.
4. Record the project's existing instruction precedence, subject to the host's
   actual hierarchy and current user instructions. Do not invent an ordering
   such as "Rules.md overrides AGENTS.md" from file names or MUST wording.
   Narrower scope wins only when the governing hierarchy says it does.
5. Surface conflicts with both source locators and the decision needed. Keep
   disputed new policy proposed; preserve existing rules while reporting the
   conflict. Do not use a new Rules.md to silently resolve product choices.
6. Create the file using [assets/Rules.md](assets/Rules.md). In an existing file,
   preserve unrelated prose, IDs and still-valid obligations. Update only
   affected records with source-backed changes and a change-log reason; retire
   superseded rules rather than deleting or renumbering them. Preserve an
   existing representation unless changing it is necessary for this request.
   Never rewrite AGENTS.md, roadmap or manifesto as a side effect.
7. List applicable active MUST release rules in two groups: mechanical required
   checks and human decisions. A proposed/retired rule is never a blocker.
   Non-release obligations remain rules but do not appear in release blockers.
   Include inherited effective obligations even when their original prose is
   retained. Cross-check the inventory against every prior obligation; explain
   any changed applicability or retirement rather than silently dropping it.
8. Verify unique IDs, all eight fields per normalized record, valid strengths
   and statuses, real source locators, exact applicability, and a verifier for
   every MUST. A human check requires a sourced role or an explicit unresolved
   owner, not an invented approver. Missing exception authority grants no waiver.
   Check blocker IDs against the rules. No rule may claim to authorize a deploy.

## Recovery and finish

If the repository or grounding is unreadable, report the missing input without
writing an invented policy. If canonical sources conflict, finish unambiguous
rules and identify the affected proposed records and required decision.
Report `Rules.md` path, Fable evidence, active/proposed/retired counts, sources,
changes, conflicts, checks actually run and unrun commands. Stop after the file
and report are complete or a model/input gate prevents meaningful work.
Do not launch Preflight, benchmark, push or deploy as part of this skill.

Invoke in OmO: `/skill:init-rules <repo>` or `$init-rules <repo>`.
Example: `$init-rules establish our release and contribution obligations`.
A request to document repo layout alone belongs to init-deep, not init-rules.

Unbenchmarked. Revisit when rules, authority, sources, model identity or host
routing change. Review history: `../preflight/references/`.
