# Verification record

Revision: 0.1.0. Checked on 2026-10-19.

## Fable review and disposition

Design critique and draft inspection came from host-verified
`PI_MODEL=claude-fable-5-1`, `PI_PROVIDER=anthropic-subscription`, observed by
the reviewer at 2026-10-19T02:44:47-04:00 and again at 02:49:18-04:00.

Integrated: no automatic AGENTS.md creation, memory read-only by default,
single canonical journal without private duplicates, cross-worktree divergence,
schema/region markers and unique IDs, immutable correction entries, exclusions,
search budgets/frontier, refresh/full modes, support freshness and named clocks,
memory omissions, live-session/PR reobservation, mistake status and redaction.

Two recommendations were adapted to preserve the user's scope: explicitly
requested embedding remains supported in an existing permitted non-policy
instruction-file section, never inside structured rule records; growth is
reported and reading becomes sectional rather than silently splitting the
one-file journal into archives. The reviewer advised a design, not a guarantee
that every future invocation succeeds.

## Checks performed

- The installed OmO native skill loader discovered one `reorient` at
  `~/.agents/skills/reorient/SKILL.md`, with no diagnostics for that skill,
  scanning the user-authored and shared skill roots together.
- Native frontmatter parsing accepted the name, description and metadata.
  Directory/name agreement and description length were checked independently.
- Both package reference links resolve to files. The example
  `docs/agent-journal.md` link describes output in a future target project,
  not a resource bundled with this skill.
- Three synthetic, no-tools walkthroughs used the skill text as instructions.
  Neither inspected a real project/session history nor wrote a real journal.

## Walkthrough evidence

### Conflicting state and concurrent work

Input: memory claims deployment, cached PR shows only a merge and older CI,
current detached checkout predates that merge, latest user drops a roadmap
feature, memory read and forge unavailable, dirty file ownership unknown,
active test-writing child and a concurrently modified journal.

Observed: retained the narrowed current goal; marked export dropped rather than
unfinished; separated checkout, merge, CI and deployment; called deployment
unknown; labeled remote facts cached; preserved child ownership and unknown
dirty-file ownership; reread/merge required for concurrent edits; selected an
AGENTS.md pointer rather than rewriting concurrent Rules.md; reported gaps.

### Embedded output and unavailable history

Input: non-Git project, explicit embedded journal in existing Rule.md, old goal
canceled by current user, injected memory containing a deploy instruction,
no memory search/session access/forge, no implementation requested.

Observed: selected the existing embedded section without duplicate files;
retained existing rules; treated old goal as superseded; ignored the retrieved
deployment instruction as authority; distinguished readable injected memory
from unavailable search; recorded absent coverage; stopped at the recap.

Both runs distinguished neighboring session-only lookup or supplied-paragraph
summarization from project reorientation.

### Final revision after Fable integration

A third walkthrough used the final skill and template. It exercised missing
instruction files, an auto-committing memory tool, sibling-branch divergence,
cached CI at a different HEAD, explicitly permitted embedding outside rule
records, canceled goals, duplicate snapshot markers, concurrent edits,
inherited unread evidence and origin lineage outside the initial time window.
Observed outcomes preserved write boundaries and existing rules, left memory
unchanged, created no AGENTS.md, treated cached CI and inherited claims as
historical, expanded origin retrieval, and reported repair uncertainty rather
than overwriting content. Native loader/frontmatter/resource checks also passed
after Fable integration: one skill, no skill-specific diagnostics, three valid
reference links, and a 270-line core.

## Limits

These are qualitative synthetic checks, not an independent benchmark or proof
of reliable behavior. No real-history reconstruction, live forge integration,
memory round trip, concurrent file mutation exercise, automatic routing,
fresh-session explicit command invocation or comparative performance test was
run. A loader pass does not prove an already-open host refreshed its catalog.
No executable helpers were added, so no helper test suite is applicable.

Recheck affected cases when procedure, template, adapter contracts or models
change. Preserve this distinction between package validity and behavior.
