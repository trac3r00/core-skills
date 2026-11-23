---
name: optimize-omo-config
description: "Inventory real OmO model access and draft evidence-backed routing proposals. Use when asked to optimize model routing. Not for first-run setup (onboarding)."
version: 1.0.2
license: MIT
metadata:
  agentskills:
    tags: [omo, model-routing, config, providers]
---

# Optimize OmO configuration

Produce a proposal, not a different lottery of favorite models on every run.
Invoke `$optimize-omo-config` or `/skill:optimize-omo-config`. Paths below are
relative to this skill directory. The helper requires Node >=24 and no packages.

## Capture the real host

1. Identify host, OmO/engine version, active config file and native block.
   Inspect the installed schema/resolver and loaded categories/agents, including
   custom entries. Read `references/native-contract.md`; it is an observed
   contract, not authority over a different installed version. Never inspect
   credential stores, browser cookies, account identities, or raw bearer tokens.
2. Inventory the native registry's complete `getAll()` catalog separately from
   `getAvailable()` when exposed by the current host. The safe CLI catalog is
   `omo --offline --list-models` (both flags appear in `omo --help`; confirm on the
   host before relying on its output); it contains unconfigured providers too.
   Catalog presence proves neither access nor model quality. Do not invent
   provider/model IDs or silently substitute aliases.
3. Check each configured provider with
   `omo auth check --provider PROVIDER --json --no-refresh`, then each relevant
   available model with `--model MODEL`. Do not use `--credentials`, print-key
   commands, or OAuth refresh. Strip account names and other identities from
   retained records. Classify OAuth versus API key separately from subscription
   versus metered billing: OAuth is not proof of free usage.
4. A provider `ready` response or credential-resolvable model is not confirmed
   model entitlement, balance, or inference success. Set `modelStatus: unknown`
   unless a recent successful request for that exact model or an authoritative
   entitlement result establishes it. Check paid balance separately. Do not make
   paid or quota-consuming probes without an explicit bounded test budget.
   Report every unavailable/unknown candidate and its reason, not just winners.

## Gather comparable evidence

Read and use **ultimate-browsing** for official model capabilities, context/output
limits, pricing, and relevant benchmark documentation. Preserve origin URLs,
versions, retrieval dates, and limitations. Do not infer capability from a model
name, marketing tier, another provider's alias, or OAuth availability.

Create a local snapshot matching `references/snapshot.schema.json`. This is
normalized JSON, not a live JSONC file. Retain the existing configuration
unchanged as `existingConfig`; identify the actual active `[native]` or `[senpi]`
block. Mark the target inventory complete only after inspecting the host.
Snapshot evidence must be real; the test fixtures are synthetic and **must never
be used as recommendations or capability evidence**.

For each target define one versioned `comparisonSet`: the same tasks, grading
rubric, tool conditions, and cost basis for every candidate. Record measured
quality (0-100), trial count, strengths, weaknesses, observed time, cost per run,
and source references. Different benchmarks are not interchangeable merely
because both report a percentage. Unknown weaknesses remain unknown, not
invented. `local:` references must resolve to an actual retained evidence ledger;
the helper validates their shape, not the truth of their contents.

Use existing comparable evidence first. If additional evaluation is authorized,
freeze tasks, inputs, grading, repetition count, and budget before running any
model. Use native role/model execution so auth and fallback behavior are real;
record the model that actually served each request. A fallback result is not
evidence for the originally requested model. Collect failures as well as passes.
No fixed sleeps or timing-luck tests. If evidence or budget is missing, finish the
inventory and return explicit gaps rather than fabricated scores.

## Freeze policy, then compute

Agree on and retain one policy version, freshness windows, minimum trials/quality,
quality tolerance, billing modes, maximum per-run cost, and maximum chain length
(1-4 models, not a required minimum). Use fewer when fewer candidates qualify;
never pad the chain with an ineligible model. Do not change thresholds or scores to justify a
preferred winner. Reuse the same snapshot and policy for repeated runs.

```sh
node <skill-dir>/scripts/plan.mjs /absolute/path/to/snapshot.json
node --test <skill-dir>/test/plan.test.mjs
```

The helper takes exactly one snapshot path (regular file, at most 2 MiB), is
read-only and offline, and prints canonical JSON. It filters unknown,
stale, future-dated, incompatible, over-budget, or incomparable evidence. At
each fallback position it takes the highest-quality band within the explicit
tolerance, then lowest measured cost, then the incumbent at that position,
then highest score, then exact model reference in code-point order. Thus a
quality loss inside the selected tolerance is an explicit cost/stability tradeoff.
Set tolerance to zero when no quality loss is acceptable.

Output includes the normalized snapshot SHA-256, rankings, auth/billing classes,
evidence references, exclusions, per-target before/after values, and proposed
configuration. Equivalent inventory enumeration produces identical output;
new evidence may legitimately change it. Explain each changed assignment and
which evidence or policy input changed. Never claim a universal best model.
Freshness is measured against the snapshot's `capturedAt`, not today's clock.
An old snapshot is replay evidence only: refresh access, balance, and model-fact
checks before claiming current usability or preparing an application-ready draft.

Legacy `model`/`fallback_models`, per-model object settings, disabled targets,
and model-dependent overrides are not silently discarded. Their candidate
rankings remain visible, but config replacement is marked `needs-review`.
Resolve those cases against the current host contract and validate the resulting
draft explicitly. Unrelated config and custom targets remain unchanged.
Exit 0 means a proposal for every target; exit 1 means unresolved targets;
exit 2 means invalid input. **Exit 0 is not deployment or full native validation.**

## Validate and independently review

1. Run the helper twice and compare canonical output and snapshot hash. Run its
   tests, inspect the actual diff, and account for every requested role/category.
2. Parse the proposed full config using the installed host's native validator
   or supported dry-run. The helper validates only its snapshot/routing contract,
   not every native config field. If that validator cannot be invoked safely,
   report the exact missing validation and keep the proposal unapproved.
3. Read and use **pro-review** with the explicit GPT-6 Pro engine. Scope the
   sanitized proposal, policy, evidence ledger, current contract, and meaningful
   changes. Never upload account identities, tokens, private prompts, or private
   knowledge sources. Verify the nonce-bound report and recorded Pro selection;
   reproduce findings locally before accepting or fixing them. Another model or
   an unverified report is not Pro review.
4. Bind successful checks, installed-host validation, and a verified GPT-6 Pro
   **APPROVE** to the exact final snapshot and proposal digests. A verified
   `REQUEST_CHANGES` or `INCONCLUSIVE` report is not approval. Failed,
   unavailable, or superseded checks keep the proposal unapproved. Any later
   edit to the proposal, policy, or supporting evidence invalidates affected
   results: rerun the relevant checks and review on the final revision.
   Repeated quota-consuming evaluation still needs the existing explicit budget.
5. Report the candidate list, selected chains, strengths/weaknesses, exclusions,
   cost/access assumptions, validation results, Pro evidence, and unresolved
   cases. No readiness claim when a required gate is missing.

Do not write live config, change accounts, pin providers, install packages, or
restart sessions merely to prepare a proposal. Applying a reviewed diff requires
explicit authorization for that destination. If the user is away under
`watcher`, record missing budget, access, or approval in plain text and continue
independent inventory and analysis rather than opening question tools.
