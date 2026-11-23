---
name: preflight
description: "Build one project-specific pre-release gate script mapped to roadmap and Rules.md. Use when asked for a pre-live check. Not for code review (review-work)."
version: 0.1.3
license: MIT
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [release, gate, checks, qa]
---

# Preflight

Put the project's existing commitments in order before release. Produce one
executable gate that checks the candidate against those commitments, instead of
inventing attractive work or adding another disconnected framework.

## Inputs and output

Use the requested repository and release candidate, current roadmap milestone,
manifesto/goals, `Rules.md`, applicable root/nested `AGENTS.md`, README,
expectation/LoE contracts when present, manifests, CI and release scripts.
Discover actual paths and casing, including `Agents.md` and `Readme.md`; read
their contents rather than assuming all named files exist. Record absent sources.
Use documented equivalents; if required intent is missing, block that coverage
instead of generating a roadmap or Rules.md implicitly.

Create or update exactly one gate entry script in the repository's established
location, normally `scripts/preflight.<native-extension>`. Use the project's
existing runtime, command runner, and tests. Keep the gate's requirement map and
source fingerprints inside that script; do not create a separate configuration
system, parallel test framework, or stack-specific universal template.
The script may invoke existing check scripts and consume existing evidence.
If an existing entry point already fulfills the contract, retain it and add
only missing checks. Do not create a wrapper merely to obtain the filename
`preflight`; report the actual reusable entry point.
Add ordinary gate tests in the established test suite where one exists.
Do not install hooks, change CI, push, publish, or deploy unless also requested.

## Establish what is being released

1. Read sources and inspect actual commands, including commands they call.
   Identify release artifact, supported environment, build mode, entry point,
   base revision and intended scope. Record current working-tree changes,
   including untracked release inputs; a Git hash alone is not candidate identity.
   Declare source mode or supplied-artifact mode. In source mode, finish
   authorized preparation/build before freezing the resulting artifact identity
   for shipped-candidate checks. In supplied-artifact mode, inspect those bytes
   immutably; never rebuild over a defective package and claim the original
   passed. Keep prerequisite source checks distinct from artifact evidence.
2. Build a compact traceability map before coding:

   ```text
   Goal/milestone or EXP ID | Source/section | Rule ID/strength | Changed behavior
   | Exact verifier | Expected observation | Mechanical or human | Blocking?
   ```

   Give every changed behavior a goal, maintenance obligation, or explicit user
   decision. Include bug fixes and necessary infrastructure; absence of a feature
   on a roadmap alone does not prove drift. Unmapped additions need a decision,
   not an invented goal. Existing commitments outrank novelty.
   Bind the reviewed behavior inventory and scope decisions to the release base
   and relevant implementation-input fingerprint. Changes between runs require
   reconciliation of that inventory, not merely recording a new candidate digest.
   Passing old tests does not establish that newly added behavior is in scope.
   Preserve inherited effective rules regardless of their original record format.
3. Separate source facts, explicit policy, and proposals. Surface contradictions
   between roadmap, rules, README and implementation. Follow host instruction
   priority; do not resolve a product-policy conflict by silently editing docs.
4. Identify non-automatable judgments: usefulness, strategy alignment, acceptable
   UX, operational approval. Make them mandatory only when an applicable
   obligation requires them or an unresolved choice changes acceptance. Do not
   manufacture an approval requirement when deterministic acceptance suffices;
   existing explicit user decisions need no ritual reapproval.
   Use an existing review/attestation mechanism only if
   it binds the decision and authorized reviewer to this exact candidate, source
   versions, and target environment. Otherwise report BLOCKED with what decision
   is missing. A comment, an arbitrary environment variable, or an unconditional
   "approved" flag cannot replace that evidence.
5. For reused FDD/DFT or other behavioral evidence, bind the actual criterion
   meaning/version, verifier/journey, relevant fixture/configuration, artifact
   and environment. An unchanged EXP ID is not enough when its meaning changes.
   Invalidate only affected evidence; do not invent universal freshness periods.
6. Apply exceptions only when the governing rule permits them and the actual
   authorized decision covers this rule and scope, including candidate/validity
   limits when specified. Report WAIVED with that decision reference, not PASS.
   Missing or mismatched waiver evidence leaves the original obligation in force.
   A rule's exception owner alone, blanket approval or bypass flag is not a grant.

## Design the single script

Choose only applicable checks with a source and an observable failure:

- Intent: coverage of required outcomes and documented scope decisions.
- Rules: MUST DO and MUST NOT DO constraints, plus applicable DO/DO NOT guidance.
  Advisory guidance is not a release blocker unless project policy says so.
- Integrity: prerequisite files/tools, lockfile/environment consistency, candidate
  and source freshness, supported configuration without exposing secret values.
- Correctness: existing lint/type/test/build commands with real exit handling;
  include bounded FDD replay or fuzz smoke only where relevant and available.
- Shipped behavior: actual candidate entry-point smoke and critical DFT journeys,
  including persistence/recovery required by the acceptance criteria.
- Packaging/operations: required assets and runtime dependencies; migration,
  compatibility, rollback and health evidence where the release requires them.
  Preflight must not perform live migrations or deploy in order to check readiness.

For each mandatory criterion without a verifier, implement the smallest
independent assertion in the gate or an ordinary regression in the existing
suite if authorized. If real tools, credentials, or human judgment are missing,
keep the check visibly blocked. Never use `echo`, `true`, existence-only checks,
keyword scans, or a model's "looks aligned" verdict as behavioral proof.
File-existence and hash checks prove integrity/freshness only, not correctness.

The script must:

1. Resolve the repository from its own location; accept explicit candidate/base
   arguments when needed; reject unknown arguments and ambiguous targets.
   Document its dependencies, invocation, network requirements, side effects,
   maximum run budgets, output and exit statuses in its header/help.
2. Fail closed on missing mandatory inputs, unavailable checks, invalid evidence,
   stale mapped sources, test failures and timeouts. A clean checkout with no
   selected checks is not a PASS. Optional checks can be NOT APPLICABLE only with
   an applicability reason. Required skips remain BLOCKED.
3. Embed the exact source paths/sections and fingerprints used to derive its map.
   Changed sources require re-reading and reconciling the map through this skill;
   never auto-refresh hashes just to turn the gate green.
   Finish authorized runner/manifest integration before taking those fingerprints.
   Define hash domains explicitly: never embed an expected digest inside the
   bytes it covers. Separate authoritative inputs from generated map/report
   fields; observe the finalized gate digest at runtime or in existing external
   evidence. Do not evade circularity by ignoring arbitrary release inputs.
4. Identify the actual tested bytes/configuration, including dirty/untracked
   inputs and artifact digest as relevant. Detect meaningful candidate changes
   during checking. Account for declared generated outputs without ignoring
   arbitrary source changes. Test the built candidate, not a stale installed copy.
5. Run commands with explicit argv/cwd/environment; do not execute commands
   extracted dynamically from Markdown or feed document text into shell eval.
   Inspect hooks and child commands for unintended release side effects.
6. Use bounded deadlines (as failure deadlines, never sleeps) and clean up
   owned child processes on failure or signal. Reuse native runner timeouts where possible; do not assume GNU `timeout` exists.
   Run isolated checks safely; no production writes or silent dependency installs.
7. Print one result per mapped obligation: ID,
   PASS/FAIL/BLOCKED/NOT APPLICABLE/WAIVED, evidence or command, and reason. Keep failures visible through pipelines.
   Return `0` only when every applicable, non-waived mandatory obligation passes
   and every waiver is valid under the governing policy. List waivers separately
   in the summary so exit 0 never implies their checks ran. Use nonzero for both
   failures and incomplete coverage, with distinguishable diagnostics.
8. Be usable noninteractively in CI. No prompts that wait forever, automatic
   retries until green, suppression, `--force` bypass, or build-only readiness.
   A plan/dry-run mode, if useful, must say NOT CHECKED and never claim readiness.

## Prove the gate catches failures

Inspect diagnostics before running. Exercise the normal candidate once, then
use isolated task-owned fixtures/copies for negative paths; never corrupt the
user's working tree to test the checker. At minimum prove:

| Scenario | Required result |
| --- | --- |
| Satisfied mapped obligations and actual smoke | 0, all mandatory IDs PASS |
| A real required command or behavior fails | Nonzero, correct failing ID |
| Required tool/source/evidence is missing | Nonzero, BLOCKED with reason |
| Roadmap or rules changed since mapping | Nonzero, stale map reported |
| Scope decision or candidate-bound approval is missing | Nonzero, not inferred |
| Implementation changed since scope review, tests still pass | Nonzero until behavior inventory is reconciled |
| Criterion meaning changed but its ID and candidate stayed the same | Prior evidence invalidated for that criterion |
| A supplied candidate is defective but rebuilding would fix it | Fail without replacing the supplied bytes |
| Two unchanged gate runs, then an authoritative source edit | Unchanged runs stay valid; the source edit blocks |
| Deterministic acceptance suffices; no applicable approval policy | No invented human blocker |
| Allowed exception has a valid decision covering this rule and scope | WAIVED with decision reference, never a fabricated PASS |
| Exception owner exists but no applicable decision was made | Original mandatory obligation remains in force |

Also exercise timeout/cancellation cleanup and candidate mutation when the script
owns processes or claims candidate freshness. Verify at least one failure by
breaking the real tested behavior rather than only mocking a command exit.
Do not assert prose wording in tests; assert statuses, IDs, exits, and behavior.
Stop owned processes and delete only disposable artifacts this task created.

## Recovery and finish

Fix gate defects, not inconvenient obligations. On product failure, keep the
gate red and report the reproduction unless fixing that product is authorized.
If all sources or runnable behavior are unavailable, do not ship an all-green
stub. Report missing inputs; any partially generated gate must remain nonzero.

Stop when the one script is installed, its mapped checks and negative cases
are exercised, and coverage gaps are explicit. Report script path and exact
invocation, source-to-check map, candidate identity, actual exits, blockers,
manual evidence, runtime needs and cleanup. Say "passed the declared checks,"
not "guaranteed to work live." Release approval remains a separate action.

Invoke in OmO: `/skill:preflight <repo and release target>` or `$preflight <target>`.
Example: `$preflight create our pre-live gate for the invoice-export milestone`.
A request to deploy now or brainstorm new features alone is a near miss.

Unbenchmarked. This is a generator procedure, not a prewritten gate for any
repository. Revisit after roadmap/rules, release mechanics, acceptance, or
environment changes. Dated review records live in `references/`; they are
history, not instructions.
