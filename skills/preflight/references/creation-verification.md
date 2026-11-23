# Skill suite creation verification

Date: 2026-10-19. Revision: initial 0.1.0 packages (historical receipt).
Location: `~/.agents/skills/{loe,fdd,dft,init-rules,preflight}/`.
For revision 0.1.1, see [ultrabrain-review.md](ultrabrain-review.md).

## Executed structural checks

The current OmO runtime's `core/skills.js` `loadSkillsFromDir` loaded each of
the five names exactly once from `~/.agents/skills`, with no diagnostics for
their paths. Parsed YAML headers with `Bun.YAML.parse`; verified directory/name
agreement, portable names, nonempty quoted single-line descriptions within
1,024 characters, and body lengths below 500 lines.

The runtime's `core/skill-invocation.js` accepted both `$name` and `/skill:name`
for each skill. `formatSkillInvocationPrompt` and `parseSkillBlock` round-tripped
the complete body and representative user request. This proves parser/expansion
compatibility, not that an already-open conversation refreshed its skill list.

Read all five final skill bodies and the Rules.md template. The only linked
resource in the core procedures is `init-rules/assets/Rules.md`; it exists and
its rule representation has the heading ID plus seven fixed record keys.
No executable helpers or runtime dependencies are shipped in these packages.
No application build, lint, or test run is called for by these prose-only changes.

## Manual workflow walkthroughs

These are design walkthroughs, not executed product workflows or model benchmarks.

| Skill | Representative case and expected output | Boundary checked |
| --- | --- | --- |
| LoE | Offline invoice export: EXP IDs for exported record equality, supported consumer reimport, and failure preserving an existing file; scope excludes a new dashboard | An hours estimate alone is not Level of Expectation; unknown performance thresholds are not invented |
| FDD | String-array codec: round-trip oracle; valid Unicode/separator cases; malformed framing rejected without partial persistence; minimized failing bytes retained for replay | A deliberately lossy codec does not inherit a false equality oracle; ordinary unit execution alone is not fuzzing |
| DFT | Packaged export: follow README setup, use shipped UI, reopen through supported importer, compare IDs/totals, test unwritable destination | A toast or mocked API does not prove persistence; unavailable real UI makes that journey BLOCKED |
| init-rules | Read existing contribution/release obligations, create stable grounded records, retain inferred roadmap policy as proposed, list only applicable active mandatory blockers | Wrong or unknown model cannot author locally; no silent fallback; Rules.md cannot invent precedence over AGENTS.md |
| Preflight | Map export goal and applicable rules to real test/build/smoke checks inside one project-native gate script | Missing checks, stale roadmap/rules, absent candidate-bound decisions, failing behavior or timeout cannot produce exit 0 |

Cross-skill walkthrough: LoE supplies acceptance IDs; init-rules supplies rule
IDs and strength/scope/status; FDD supplies bounded replayable invariant checks;
DFT supplies real-candidate journey observations; Preflight maps only applicable
requirements to checks, preserving human decisions as explicit blockers rather
than fabricating automatic strategic approval. None requires recursively
invoking every other skill.

The Fable draft's proposed fixed document-precedence ladder was removed during
integration. The installed skill uses the host's actual hierarchy and sourced
project precedence instead. The draft's illustrative, unsourced exception role,
waiver label, and branch-protection assumptions were not adopted as project facts.

## Fable provenance

The authoring child ran through OmO's `architect` route. Completion metadata
identified `anthropic-subscription/claude-fable-5-1`; the child independently
reported `PI_MODEL=claude-fable-5-1` and
`PI_PROVIDER=anthropic-subscription`. On this host `ultrabrain` routes to Astra,
so it was not mislabeled as the Fable route. Future invocations verify identity
again rather than trusting this historical result.

## Limits and cleanup

Not run: automatic skill selection, a fresh interactive host invocation,
comparative benchmarks, a real project's FDD campaign or DFT journeys, or
generation/execution of a project Rules.md and preflight script. This request
created the reusable procedures, not project policy or a release candidate.
All five packages remain explicitly unbenchmarked.

No task-owned scratch directories, screenshots, fixture files, test servers,
or disposable scripts were created. The Fable child reported no file edits.
Retained artifacts are the five SKILL.md files, the Rules.md template, and
this verification record. No application files, hooks, CI, routing settings,
or deployment state were changed.

Reload OmO with `/reload`, then use `/skill:loe`, `/skill:fdd`, `/skill:dft`,
`/skill:init-rules`, or `/skill:preflight`, followed by the target task/project.
