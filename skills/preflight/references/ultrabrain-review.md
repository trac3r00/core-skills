# Ultrabrain verdict and revision evidence

Date: 2026-10-19. Reviewed revision: 0.1.0; review repairs: 0.1.1.
Current: LoE 0.1.1; FDD, DFT, init-rules and Preflight 0.1.2.

## Independent verdict

Ultrabrain returned **REVISE**, with high confidence in procedural design only.
It approved LoE's design and requested small clarifications in FDD, DFT,
init-rules, and Preflight rather than a redesign.

The independent child used the `ultrabrain` category. Completion metadata and
its own host metadata identified `gpt-6-astra`, provider
`chatgpt-subscription`. It read the five packages, Rules.md template, original
verification receipt and authoring guidance; it made no file edits, launched
no other agents, and ran no product checks or benchmarks.

The follow-up verdict remained REVISE and incorporated the parent's concrete
oracle witnesses below. Seven findings were accepted and addressed. The
original finding pointers refer to revision 0.1.0, not today's shifted lines.

## Findings and repairs

| Finding | Original evidence | Repair in 0.1.1 |
| --- | --- | --- |
| Semantic scope can become stale between runs | preflight/SKILL.md:47-59,95-101 | Bind reviewed behavior inventory and scope decisions to release base and relevant implementation-input fingerprint; implementation changes require reconciliation, not a new label |
| Relational checks can share bugs; generation can be vacuous | fdd/SKILL.md:30-39,71-83; dft/SKILL.md:67-69 | Separate relational invariants from contract conformance; calibrate against a wrong result; report attempted/executed/discarded/failing counts and required-family coverage |
| A stable criterion ID can hide changed acceptance | dft/SKILL.md:79-85,102-104; preflight/SKILL.md:55-58 | Bind reused results to criterion meaning, verifier/journey, relevant fixtures/configuration, artifact and environment; invalidate only affected evidence |
| Legacy obligations can survive textually but disappear from blockers | init-rules/SKILL.md:60-78,93-108 | Inventory inherited effective obligations regardless of format; preserve traceable IDs and mandatory meaning; unresolved inherited requirements are not speculative proposals |
| Rebuilding can replace a supplied defective candidate | preflight/SKILL.md:70-76,98-107 | Declare source versus supplied-artifact mode; finish source builds before freezing output; never replace supplied candidate bytes while claiming to check them |
| Fingerprints can be stale on creation or circular | preflight/SKILL.md:26-29,95-101 | Finish authorized integration before fingerprinting; define nonrecursive hash domains and never embed an expected digest in its own covered bytes |
| Human approval could be manufactured unnecessarily | preflight/SKILL.md:54-59,63-67 | Require human decisions only for applicable obligations or unresolved acceptance choices; deterministic acceptance needs no invented approval |

LoE additionally asks which plausible wrong result each acceptance criterion
would reject. The Rules.md template now records inherited-obligation mappings
and unresolved inherited applicability. The Fable requirement for authoring
actual project Rules.md is unchanged; an Astra review of the reusable skill
does not authorize replacing the project-rules author with Astra.

No orchestrator, evidence service, mandatory five-skill chain, universal expiry
period, mutation framework, or blanket human approval was introduced.

## Executed oracle witnesses

These are deliberately defective in-memory examples, not live product tests.
The parent ran the following logic in its persistent JavaScript kernel:

```javascript
const codec = {
  encode: values => 'PRIVATE:' + JSON.stringify(values),
  decode: wire => JSON.parse(wire.slice(8))
};
const values = ['a', '', '\u00e9'];
const wire = codec.encode(values);
```

Observed: round-trip equality was true. The wire began with `PRIVATE:`;
independent `JSON.parse(wire)` rejected it. This proves
that round-trip agreement alone can accept a codec violating a public JSON
contract. The revised procedure now explicitly demands the missing conformance
oracle and a representative known-bad calibration.

A second probe attempted values `[-2, -1, 0, 1, 2]` with a precondition `> 100`.
Observed: 5 attempts, 5 discards, 0 executions, 0 observed failures. The revised
procedure explicitly classifies this as incomplete coverage, not success.
Documented rejection counts only when its rejection assertion executes.

## Revision 0.1.1 package validation (historical)

The parent read the revised packages and template. Each SKILL.md passed parsed
YAML validation, version/status checks, unique discovery with no diagnostics
through the current native `loadSkillsFromDir`, and both slash/dollar token
parsing plus complete-body expansion/parse round trips through the native
`skill-invocation.js` API. All descriptions remain within 1,024 characters and
all bodies below 500 lines. The linked Rules.md asset was read successfully.

| Package | Lines | Verified SKILL.md SHA-256 |
| --- | --- | --- |
| loe | 101 | c43ec4660b5838b0317f4d8297c391146414804362a2d5ff3dcc6695cb7c4411 |
| fdd | 119 | 16926e46f05d2228de2933ed66f7b2330eb78e2df65a0c920f3ff4c0aaf83424 |
| dft | 122 | 067b91d74d88a418d20b55ccfa4cfd4544d5394bdbf55e635cedf2b8ca0ce0f4 |
| init-rules | 144 | d089149c8143e6abd39bd079109de6e4da7c98c0065dfd5e65318474e3eecacd |
| preflight | 185 | 9f90712c0aa7fdaec78cd943af2d1c7e147567934da70edf6eac2ae65dd13acb |

## Adversarial design walkthrough

These rows are manual checks of the procedures' decisions, not executed project
gates, product journeys, or proof that a model always follows instructions.

| Scenario | Revised required decision |
| --- | --- |
| Offline promise conflicts with requested remote validation | LoE exposes affected acceptance and the unresolved product choice rather than inventing a guarantee |
| Encoder and decoder share the PRIVATE prefix defect | FDD's public-consumer conformance check rejects the output despite the round-trip pass |
| All generated inputs are filtered before assertion | FDD marks incomplete coverage and repairs or explains the generator gap |
| Exporter/importer both omit tax | DFT compares specification-derived expected totals or an independent consumer, not shared agreement |
| Legacy prose requires restore evidence before release | init-rules retains a traceable effective obligation; missing required evidence remains blocking |
| Telemetry is added after export scope review while old tests still pass | Preflight invalidates scope coverage until the changed behavior inventory is reconciled |
| EXP-001 adds currency codes while ID/candidate stay unchanged | Old evidence cannot prove the new meaning; unaffected evidence remains reusable |
| Supplied package lacks an asset that a rebuild would restore | Supplied-artifact checks fail without replacing its bytes |
| Manifest integration changes derivation inputs | Finalize authorized integration first; unchanged repeat runs avoid self-invalidation; authoritative edits still invalidate |
| Maintenance change has deterministic acceptance and no approval policy | No mandatory human attestation is invented |

## Limits and cleanup

Ultrabrain has not re-reviewed the 0.1.1 or 0.1.2 text; the parent implemented and
checked its findings. Do not represent the original REVISE as final reviewer
APPROVE. All packages remain **unbenchmarked**.

Not run: comparative model evaluation, automatic selection, a fresh interactive
skill invocation, or generation/execution of an actual project's Rules.md,
preflight script, fuzz campaign, or product dogfood journeys. Parser compatibility
and manual design checks are not evidence of live release readiness.

No disposable files, scratch directories, processes, or test services were
created. Only the five packages, Rules.md template, historical-receipt link and
this retained report changed. No application, CI, hooks, routing or live state
was modified.

Reload OmO with `/reload` to refresh discovery. Invoke `/skill:loe`,
`/skill:fdd`, `/skill:dft`, `/skill:init-rules`, or `/skill:preflight` with the
specific task or project.

## Discretionary adjustments: revision 0.1.2

At the user's request for further adjustments, the parent made four focused
repairs. LoE remains unchanged because no additional defect was identified.

- FDD: shrinking must retain the violated property, input-domain preconditions
  and failure class. An unrelated parse failure cannot replace the original
  bug. The JSON example now uses JSON-specific invalid families instead of
  generic framing/length examples.
- DFT: state-changing journeys establish their initial state and verify an
  action-specific delta, preventing old files, cache entries or prior records
  from being mistaken for this candidate's successful action.
- init-rules and its template: distinguish an exception owner from an actual
  scoped, authorized waiver. Preserve the rule and decision reference; apply
  candidate or time limits only when governing policy requires them.
- Preflight: reuse an adequate existing entry point instead of creating a
  filename-only wrapper. Report a valid authorized exception as WAIVED, not
  PASS. An owner, blanket approval or mismatched decision does not waive a rule.

Executed validation: all five packages passed parsed YAML, expected revision,
unbenchmarked status, unique native discovery without diagnostics, slash/dollar
token parsing and full-body invocation expansion/parse checks. The Rules.md
template still has exactly eight fields per record: heading ID plus seven
keys. The template was read and its linked path exists.

| Package | Revision | Lines | Verified SKILL.md SHA-256 |
| --- | --- | --- | --- |
| loe | 0.1.1 | 101 | c43ec4660b5838b0317f4d8297c391146414804362a2d5ff3dcc6695cb7c4411 |
| fdd | 0.1.2 | 123 | 186b7538a4172e411337e7e68708c24e2213aa4504da51f22da22d5b80851efa |
| dft | 0.1.2 | 126 | 6a08bf655f2904672be7bdd6b9490ce975f3c43e6fe3c960fcdd67154d9386f1 |
| init-rules | 0.1.2 | 152 | f932fcbf6f4ed981c495dbba0acb26158f87a468eadb2e9b1102ec52da7293a9 |
| preflight | 0.1.2 | 197 | 815781916a4f19164533b908a7ceb5a98bf8dc04a01462ec93fccc0fb8651dc6 |

Manual consistency walkthroughs, not executed project tests:

| Case | Required decision |
| --- | --- |
| Shrinking a valid-domain ordering defect yields malformed JSON | Keep the original reproducer; classify the parse failure separately |
| Export action does nothing but its destination already contains old output | No action-specific delta, so the journey cannot pass |
| A source-authorized exception covers this rule and candidate | Report WAIVED with decision reference, never claim the check passed |
| Only the exception owner is named, or the decision covers another scope | Original obligation remains in force |
| The repository's release-check entry point already fulfills Preflight | Reuse it; do not add another wrapper |

The Fable project-rules authoring requirement is retained. This pass added no
runtime code, helpers, dependencies, new test framework, scratch files or
processes. Product execution, model-effectiveness benchmarks and final
ultrabrain approval remain unverified as stated above.
