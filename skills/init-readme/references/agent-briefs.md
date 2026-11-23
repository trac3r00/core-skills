# Agent briefs

Fill every `<...>` before spawning. Paths are absolute. `<scratch>` is the
task-owned scratch directory holding `packet.md`, `leads.md`, `commands.md`,
`README.draft.md` and `README.candidate.md` as defined in SKILL.md step 1.
`<existing readme>` is either the resolved `README_PATH` of a file that
exists or the literal word `absent`; never a path that does not exist. Every
project fact (`name`, `version`, `license`, `runtime`, `repository URL`) is
either a sourced value or the literal `absent`. Spawn explore agents
with `run_in_background: true` in one batch; spawn the writing agent after the
packet is merged; spawn the ultrabrain reviewer after the draft is read.
Always pass `task_summary` (under 80 characters, says what was delegated).

## Explore A: product surface

```text
subagent_type: explore
task_summary: "README facts: product surface of <repo name>"

You are gathering evidence for a README. Repository: <abs repo path>.
Read-only: do not edit files or run commands that write.

Answer with file-cited claims, one per line, in this exact shape:
  claim | <path>:<line or symbol> | observed|declared
Cover: what the project is and is not; who uses it; every user-facing entry
point (CLI commands, exported API, UI routes, slash commands); configuration
keys with their default from code and where the file lives; supported
platforms and runtime versions; what happens on first run.

Then reconcile these leads (from AGENTS.md and the old README). For each,
answer exactly one of: confirmed <path:line> | refuted <reason, path:line> |
not found.
<paste lead lines L1..Ln>

Return only the two lists and a short "gaps" paragraph naming what you could
not determine. No prose summary, no recommendations.
```

## Explore B: lifecycle facts

```text
subagent_type: explore
task_summary: "README facts: install/build/test/release of <repo name>"

You are gathering evidence for a README. Repository: <abs repo path>.
Read-only.

From manifests, lockfiles, scripts/, bin/, CI workflows and release tooling,
list with citations (claim | path:line | observed|declared):
prerequisites and their minimum versions; the canonical install command for
an end user; the dev setup command; build, test, lint, typecheck commands and
what each actually runs; release/publish procedure; environment variables
read at runtime (grep for process.env / os.environ / env::var and the like)
with defaults; Docker or service manifests.

Then list the exact commands the parent should execute to verify them, one
per line, with cwd and any safe flags (dry-run, --help is NOT acceptable as a
verification). Mark commands that need secrets, network or hardware.

Reconcile leads as: confirmed <path:line> | refuted <reason> | not found.
<paste lead lines>

Return only the lists and a "gaps" paragraph.
```

## Explore C: architecture (multi-module repositories only)

```text
subagent_type: explore
task_summary: "README facts: module map of <repo name>"

Repository: <abs repo path>. Read-only.
Produce, with citations, what a contributor needs on day one: top-level
modules or packages and their one-line purpose; the entry file and how it
wires the modules; the main data flow in at most six steps; extension points
(plugin dirs, hooks, config-driven registries); directories to read first.
Shape: claim | path:line | observed. Keep it under 40 lines. No redesign
suggestions.
```

## Writing agent: draft

```text
category: writing
task_summary: "Draft README.md for <repo name> from evidence packet"

Draft a README for <name>. Write it to <scratch>/README.draft.md and
return the path plus a list of sections you omitted and why. Do NOT write to
<README_PATH> or anywhere else in <abs repo path>.

Inputs (read all of them first):
- Evidence packet: <scratch>/packet.md. Only lines marked observed or
  declared may be used. Lines marked lead are forbidden.
- Section standard: <abs skill dir>/references/readme-standard.md
- Template: <abs skill dir>/assets/README.template.md
- Existing README: <existing readme>. When it is a path, apply the
  preservation decisions in <scratch>/leads.md (`kept` assets must appear,
  `removed` ones must not, `replaced` ones use the cited packet line); the
  user additionally named these sections to keep: <list or "none">. When it
  is `absent`, there is nothing to preserve.
- Command log: <scratch>/commands.md. A command may appear in the README only
  if its entry is `run` with exit 0; cite it as `<!-- C<n> -->`. Entries
  marked `failed` or `not run` are left out entirely; do not include them
  with a caveat, footnote, or "unverified" label.

Audience: <library consumer | CLI user | service operator | extension user>.
Project facts: name <value, source>, version <value|absent>,
license <value|absent>, runtime <value|absent>, repository URL <value|absent>.
A fact that is `absent` gets no badge, no sentence, and no placeholder.

Rules: follow the standard's order and writing rules; after each sentence
that states a non-obvious fact add `<!-- E<packet id> -->`; no adjectives
without a cited source; stay inside the length budget; link out instead of
inlining long material, and only to files that exist in the packet.
```

## Ultrabrain reviewer: verdict

```text
category: ultrabrain
task_summary: "Verdict on README draft for <repo name>"

You are the approval gate for a README. You are read-only: do not edit any
file, do not spawn agents. Decide whether the draft may be written as
<README_PATH>.

Read: candidate <scratch>/README.candidate.md (the exact bytes that would be
written) and draft <scratch>/README.draft.md (same text with evidence
comments); evidence packet <scratch>/packet.md; command log
<scratch>/commands.md; lead reconciliation and asset decisions
<scratch>/leads.md; section standard
<abs skill dir>/references/readme-standard.md; the parent's validation
result for the candidate (link/image resolution, lint): <summary>; existing
README: <existing readme> (when `absent`, Q9 and Q12 have nothing to check
and pass vacuously). The candidate would be written to <README_PATH>.
Spot-check at least five cited packet lines against the repository files
they name, choosing the ones that would mislead a user most if wrong, and
at least two commands against commands.md. When the candidate contains
fewer claims or commands than that, check all of them; never ask for
content to be added to meet the sample size.

Your reply MUST begin with exactly one of these two lines and nothing before
it:
VERDICT: APPROVED
VERDICT: REVISE

Then a findings table:
id | severity (blocking|major|minor) | location (draft line) | problem |
evidence (path:line or log entry) | required change

Rules for the verdict:
- Any Q1, Q2, Q5, Q7, Q9 or Q11 failure from the standard's checklist is
  blocking. REVISE if any blocking finding exists.
- A command without a `run`, exit-0 entry in commands.md is blocking, even
  when annotated as unverified, optional, or example.
- A claim you cannot trace to the packet is blocking even if it is true.
- Taste comments are minor and never justify REVISE on their own.
- APPROVED means: a new user following this README would succeed, and no
  sentence in it is unsupported by the repository as it is today.

On a resubmission you will receive a change list keyed by your finding ids.
Re-check only those and anything they touched; keep ids stable; add new ids
for new problems. Produce the VERDICT line again.
```
