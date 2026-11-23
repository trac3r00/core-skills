---
name: init-readme
description: "Overhaul a root README from file-cited explore evidence with an ultrabrain review gate. Use only for an explicit overhaul. Not for a refresh (readme-init)."
version: 0.2.0
license: MIT
compatibility: "Instruction-only. Requires the host's native task delegation with the explore agent and the writing and ultrabrain categories, plus file and shell tools."
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [readme, docs, documentation, review]
---

# Init README

Produce one root `README.md` that a new user can trust: what the project is,
why it exists, how to install, run, configure, develop and contribute, with
every claim traced to a file and every command actually run. The README is a
front door, not a dump of internals; link to deeper docs instead of inlining.

## Activation and scope

Use only for an explicit request such as `$init-readme`, `/skill:init-readme`,
"write a professional README" or "overhaul the README". Target the requested
repository, otherwise the unambiguous current project; never the home
directory. Write exactly one file, the root README: resolve `README_PATH`
once in step 1 as the existing root README in whatever casing it has, or
`README.md` when none exists. Do not touch `AGENTS.md`, `CHANGELOG.md`, package manifests,
docs under `docs/`, or CI. A request for API reference, a changelog, repository
rules, or agent instructions is a near miss; name the right skill and stop.

Hard constraints that hold for the whole run:

- `AGENTS.md`, old README prose, and wiki pages are leads. A claim enters the
  README only when an explore agent cites a current file path (and line or
  symbol) that supports it. Report stale leads; never copy them.
- A command appears in the README only when `commands.md` records it executed
  in this run with exit 0. Commands that failed or could not be run (secrets,
  hardware, paid services, network) are never published, even annotated; they
  go in the report. If the install or quick-start command itself cannot be
  run, publication is blocked: stop before step 4 and report what is needed.
  No `echo` or `--help` stand-ins.
- No adjectives without evidence: "fast", "secure", "production-ready" require
  a benchmark, audit, or test the README links to.
- Preserve user-authored assets while the evidence still supports them: hero
  images and logos whose files exist, license and sponsor notices, sections
  the user names, and badges whose value traces to a packet line. A badge or
  asset the evidence no longer supports is removed or replaced with a sourced
  one, and each such change is listed in `leads.md` and the report. If the
  user explicitly asked to keep something the evidence contradicts, stop and
  ask before drafting; do not publish either version silently.
- `README_PATH` receives exactly one successful publication, after the
  reviewer's verdict is `APPROVED`. Restoring the previous file or removing a
  partial one during step 6 failure recovery is not a publication.

## 1. Inventory the repository yourself

Before delegating, read: the existing README, `AGENTS.md`, `CONTRIBUTING.md`,
`LICENSE`, `CHANGELOG.md` head, manifests (`package.json`, `pyproject.toml`,
`Cargo.toml`, `go.mod`, ...), lockfiles, `docs/` listing, `.github/workflows`,
`Dockerfile`/`compose`, and `bin/`/`scripts/`. Record the project's language,
runtime constraints, declared scripts, license, repository URL, and release
version. Note which of these are absent. Decide the audience from the manifest
and entry points: library consumer, CLI user, service operator, or extension
user. Everything downstream is written for that audience.

Fix the project facts passed to every child, each either a sourced value or
the literal `absent`: `name` (manifest name; else the Git remote repository
name; else the repository directory name, in that order, with the source
cited), `version`, `license`, `runtime`, `repository URL`, and `existing
README` (`README_PATH` when the file exists, otherwise `absent`). An absent
fact produces no badge, no sentence, and no placeholder.

Create a task-owned scratch directory. Every later step and brief refers to
these files by name:

| File | Content | Written by |
| --- | --- | --- |
| `packet.md` | One line per claim: `E<n> \| claim \| source path:line \| observed\|declared\|lead` | step 1, merged in step 2 |
| `leads.md` | One line per lead: `L<n> \| lead text \| origin \| confirmed E<n> \| refuted <reason> \| not found`; plus one line per preserved-asset decision (`kept`, `removed <reason>`, `replaced <E<n>>`). Write `none` under a heading when a section is empty | step 1, completed in step 2 and 4 |
| `commands.md` | One line per command: `C<n> \| command \| cwd \| exit code \| first meaningful output line \| run\|failed\|not run <reason>` | step 3 |
| `README.draft.md` | The writing agent's draft | step 4 |
| `README.candidate.md` | The draft with evidence comments stripped; the exact bytes to publish | step 4, regenerated in step 5 |
| `README.previous.md` | Copy of the existing README, for restore on a failed write | step 6 |

Leads from `AGENTS.md` and the existing README go into `packet.md` as `lead`
and `leads.md` as unresolved; they are not yet usable.

## 2. Fan out explore agents

Spawn at least two `explore` agents in parallel (`run_in_background: true`),
each with a disjoint brief from
[references/agent-briefs.md](references/agent-briefs.md) and the packet so far:

| Agent | Brief | Returns |
| --- | --- | --- |
| explore A, product surface | What the project does, entry points, user-facing commands/APIs, configuration keys and their defaults, supported platforms | Claims with `path:line`, plus which `lead` lines they confirm or refute |
| explore B, lifecycle facts | Real install, build, test, lint, release and CI commands from manifests and workflows; prerequisites and versions; environment variables | Same shape, plus the exact commands to run in step 3 |
| explore C, architecture (only when the repo has more than one top-level module or package) | Module map, data flow, extension points, where to read next | Same shape, limited to what a contributor needs on day one |

Each explore agent is read-only and must answer the lead reconciliation: for
every `lead` line in its area, `confirmed <path:line>`, `refuted <reason>`, or
`not found`. While they run, continue step 3 on commands you already know.

Merge their returns into the packet. A `lead` becomes `observed` only with a
confirmation citation. Conflicts between agents are resolved by reading the
cited files yourself, not by majority.

## 3. Execute the commands

Run every command the README will show, in the project's own runtime, from a
clean state where feasible (fresh clone or worktree for install steps). Record
each in `commands.md` with its exact text, cwd, exit code, first meaningful
output line, and status `run`, `failed`, or `not run <reason>`. Only `run`
entries with exit 0 are publishable. A failed documented command is a finding
for the user: it stays out of the README and goes in the report. If the
canonical install or quick-start command is `failed` or `not run`, stop here
and report the blocker; the README is not written this run.

## 4. Draft with a writing agent

Spawn one `writing` category agent with: the scratch file paths, the project
facts, the audience, the section standard in
[references/readme-standard.md](references/readme-standard.md), the template
[assets/README.template.md](assets/README.template.md), the existing README
path or `absent`, the preservation decisions from `leads.md`, and the
constraints above. It writes `README.draft.md`, never `README_PATH`. Require
it to:

- use only `observed` and `declared` packet lines, citing the packet id in an
  HTML comment after each non-obvious claim (`<!-- E12 -->`); the comments
  are stripped before the final write;
- show only `run`, exit-0 commands from `commands.md`, citing `<!-- C3 -->`;
- keep the standard's section order, dropping sections the project does not
  need with a one-line note in its return, not an empty heading;
- write for the audience from step 1; a library README leads with an import
  and a call, a CLI README with the one command a user runs first;
- stay under the length budget in the standard; move overflow to links.

Read the draft yourself against the checklist in the standard. Fix evidence
mismatches by editing the packet and re-briefing, not by softening the claim.
Then validate the candidate before review: produce the stripped candidate at
`README.candidate.md` in scratch, resolve every relative link and image path
against the repository root and record failures, and run the repository's
markdown lint or link checker if one exists (pass it the candidate with the
repository as cwd, or copy the candidate to a temporary path inside the
repository that you delete afterwards, never over `README_PATH`). A failure
here returns to the draft; nothing proceeds to step 5 until the candidate
passes.

## 5. Obtain the ultrabrain verdict

Spawn one `ultrabrain` category agent with the reviewer brief from
[references/agent-briefs.md](references/agent-briefs.md): the candidate, the
draft, `packet.md`, `commands.md`, `leads.md`, the standard, the validation
results from step 4, and the existing README path or `absent`. It is
read-only and returns a report whose first line is exactly
`VERDICT: APPROVED` or `VERDICT: REVISE`, followed by a findings table
(`id | severity | location | problem | evidence | required change`).

On `REVISE`: address every `blocking` finding and each `major` one unless you
state a sourced reason it is wrong, update the packet and draft, regenerate
`README.candidate.md` from the revised draft, rerun the step 4 validation on
that candidate, confirm the candidate equals the draft with evidence comments
stripped, and only then resubmit through `task_send` to the same reviewer
with a change list keyed by finding id and the validation result for that
exact candidate. Repeat up to three rounds. A third `REVISE` is a blocker: stop, keep
`README_PATH` unchanged, and report the open findings.

Approval is the literal first line. A review that praises the draft without
`VERDICT: APPROVED` is not approval; ask it for the line.

## 6. Write and report

Only after `VERDICT: APPROVED`: copy the existing README (if any) to scratch
as `README.previous.md`, write the approved `README.candidate.md` bytes to
`README_PATH`, and re-read it to confirm the written bytes equal the approved
candidate. If the write or comparison fails, restore `README.previous.md` (or
remove the new file when there was none) and report the failure. Delete the
scratch directory. Do not commit, push, or edit anything else.

Report: README path; audience; agents spawned with their task ids and models
as the host reported them; packet counts (observed / declared / leads refuted
or not found); commands run with exit codes, and the failed or not-run ones
that were therefore left out; assets kept, removed or replaced; verdict rounds
with finding ids resolved; what the old README said that the code no longer
supports; sections intentionally omitted.

## Recovery

- Explore agents disagree or cite nothing: re-brief the narrower question or
  read the files yourself; never promote a `lead` without a citation.
- The repository has no runnable entry point or no manifest: pass the
  affected facts as `absent`, write only the sections the evidence supports,
  and say so in the report; do not invent install steps or metadata.
- The install or quick-start command cannot be run here: stop before
  drafting and report the exact command and what it needs; a README whose
  first instruction was never run is not published.
- Delegation is unavailable on this host: do the explore work yourself with
  the same citation discipline, and state that the ultrabrain gate was not
  run; without that gate the result is a draft at a scratch path, not
  `README_PATH`.

Invoke in OmO: `/skill:init-readme <repo or request>` or `$init-readme <repo>`.
Example: `$init-readme rewrite the README for this CLI; keep the logo and badges`.

Source: the user's definition (parallel explore agents, categorized drafting,
a fixed professional section standard, AGENTS.md treated as unreliable, and an
ultrabrain `approved` verdict gate) and the local create-skills conventions.
Revisit when the host's agent categories, the explore agent, or the section
standard change. Effectiveness is unbenchmarked.
