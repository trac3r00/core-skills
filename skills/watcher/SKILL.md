---
name: watcher
description: "Supervise delegated OmO work while the user is away; fixes ship as CI-watched PRs. Use when continuation is delegated. Not for process lists (session-finder)."
version: 2.1.0
license: MIT
compatibility: "Instruction-only supervisor. Needs python3, git, and gh for PR delivery; Herdr and omo-mods runner inventory are optional and reported when absent."
metadata:
  evaluation: "scanner fixture-tested; unattended procedure scenario-checked; no long unattended run measured"
  agentskills:
    tags: [supervision, omo, delegation, pull-requests, ci]
---

# Watcher

Keep OmO responsible for the user's existing objective while the user is away,
and keep every OmO session on this machine and its managed runners moving toward
a verified result. Do not turn ordinary engineering choices into a queue of
questions. A fix that works is not finished here until it is a branch, a PR, and
a CI verdict.

This skill changes how the agent works and reports; it does not disable the
host's approval controls or grant new authority.

## Activate

Use when the user explicitly invokes `$watcher`, delegates continuation while
away, or asks to watch, audit, or keep all OmO sessions running. Take the
current task, latest corrections, accepted plan, and existing authorizations as
the scope. Do not invent another project if no objective exists.

State a short receipt in ordinary output, as plain text (never a `>` quote: OmO
draws quotes in the same grey as thinking, so they read as unfinished):

```text
Watcher active: I will finish [objective] within [scope]. I will choose
reversible defaults, record decisions here, and leave approval-only actions
pending while completing everything independent of them.
```

Do not ask the user to confirm this receipt. If no actionable objective exists,
state that plainly and do not start speculative work.

## Establish the working state

Inspect the existing plan, todo list, working changes, running jobs, and
relevant project instructions. Keep other agents' and the user's changes intact.

For work that spans turns, register it with `create_goal` (close with
`update_goal`) and track steps with `todo`; for a checkpointed loop, follow the
native `ulw-loop` skill instead of re-inventing one. Keep one
concise ledger in the project's existing work log. When none exists, reuse
`.omo/handoff/current.md` if it already holds state; otherwise write
`.omo/watcher/state.md` from [the template](assets/state-template.md). Never
maintain two ledgers.

Record:

- objective and observable completion condition;
- in-scope changes and current user authorizations;
- protected files, live sessions, budgets, and explicit exclusions;
- completed work and evidence, not just intended steps;
- active jobs and their actual handles/resumption conditions;
- chosen defaults, reversible changes, and pending approval-only branches.

Do not overwrite another task's checkpoint. Do not include credentials or
private source material that the work log does not need.

## Discover sessions

Start with one read-only scan:

```sh
python3 <this-skill>/scripts/watcher_scan.py --json
```

The scan covers every configured directory, not the current one: it intersects
the process table with the OmO session store, adds Herdr's agent list, and merges
every configured runner through `omo-mods runner status --json`. It never stops,
prompts, or edits a session. Its JSON is the evidence base; use `--json` before
quoting numbers, because the human table is a summary.

[references/discovery.md](references/discovery.md) has the exact commands, output
shapes, store layout, and known limits (Linux-only runner probe, directory-level
Herdr attribution). Read it when a session is missing or a state looks wrong.

## Triage

| State | Evidence | Default action |
| --- | --- | --- |
| `active` | live process or working Herdr pane; recent activity | observe; no input |
| `idle` | Herdr pane `idle`/`done` | leave it unless the user asked it to continue |
| `blocked` | Herdr `blocked`, or the session waits for an answer | read the prompt first; answer only within existing authorization |
| `stalled` | live session, no activity past the threshold (20 min default; `--stalled-minutes N`) | read the pane; interrupt only a loop; resume the same session |
| `failed` | error text in the last reply, or a down runner | check quota/auth, then retry the same session; never switch accounts silently |
| `unattributed` | recent transcript, no matching process (shared RPC host or non-Herdr session) | observe; do not resume merely because no process matched |
| `orphaned` | no live process and 20 min-48 h since activity | resume only if its work is unfinished; otherwise leave it |
| `unknown` | live process with no readable transcript | inspect the process or pane; do not kill it |
| `archived` / `saved` | older transcript, or a finished runner run | ignore unless the user names it |

`herdrAttention` lists Herdr agents whose status is `blocked` or `unknown`; read
those panes first. A `criticalHint` only means the title contains destructive
wording, not that approval was given.

Confirm before acting: `herdr pane read <pane> --source recent-unwrapped
--lines 120` for a host pane, `omo-mods runner status` plus `herdr pane read`
for a runner pane. Never act on a directory-level attribution alone when two
panes share that directory.

## Keep work moving

For each uncertainty, choose the appropriate branch:

| Situation | Action while the user is away |
| --- | --- |
| Repository, documentation, tests, or memory can answer it | Inspect the evidence and proceed. |
| Reversible engineering choice within scope | Choose the option best supported by conventions, record the assumption and reversal path, and implement it. |
| Missing preference with a reasonable reversible default | Use the default; report it as a decision, not a question requiring a reply. |
| Reversible session blocker (stall, orphan, provider retry) | Read the pane, retry or resume the same session, and record the evidence. |
| One dependency is unavailable | Finish all independent branches, preserve progress, and report that dependency precisely. |
| Existing job will produce the answer | Subscribe to its completion/state event, retain the handle, and work on independent tasks. Yield only when the event is the next needed input. |
| Action needs new authorization, identity, login, or irreversible user choice | Leave that action pending and continue everything that does not depend on it. |
| No independent work or observable resumption channel remains | Deliver the completed work and a precise blocker ledger; do not fabricate completion or keep an idle retry loop running. |

Clearing a reversible blocker is in scope: retry a provider or session error on
the same session after checking quota and auth; resume an unfinished session;
answer a question when the user's existing instruction covers that exact choice;
repair a repository-local environment inside the branch it belongs to; create
branches, worktrees, commits, and PRs; run tests and CI.

These stay pending, in plain text, without asking a question while the user is
away:

- destructive or irreversible actions: deleting branches, worktrees, data, or
  another person's work; force-pushes; rewriting history;
- merges, releases, deploys, publishing, payments, purchases;
- credentials, login changes, account or model routing changes, new spending;
- messaging people or changing access on their behalf;
- resuming a session the user paused, or overriding `/pause`, watchdog, or
  spending limits;
- repairing runner infrastructure the user did not ask about.

Do not call `ask_user_question` (or any equivalent interactive question tool) for ordinary decisions during this mode. Write the decision or
pending item in plain text instead. A higher-priority mandatory permission
mechanism still applies; never bypass or auto-approve it.

Unattended mode is not blanket authorization to publish, deploy, commit, merge,
purchase, send messages, change accounts, expose private notes, install software,
or stop somebody else's sessions. Use only authorizations already present for
the particular action and target. Where approval is already explicit, do not ask
for it again solely because the user is away. Do not reassign consequential
product or business decisions to an invented stakeholder; take the latest
explicit instruction and isolate an unresolvable conflict in the pending ledger.

`references/runbook.md` gives the per-failure playbook, including the stop
condition for each.

## Execute and verify

Keep scope, evidence, and the stop condition together. Reproduce reported bugs,
make the smallest correct change, and validate through the real entry point.
Mark tasks complete only when their checks support completion. Treat an unknown,
skipped, blocked, or stale check as such.

Use subagents only for independent work the host permits. Collect their results,
check their claims, and integrate their changes before calling the task complete.
Do not spawn a child merely to wait for a job.

Respect the user's pause, cancellation, runtime limits, and spending limits.
Watcher does not override `/pause`, disable a watchdog, resume a stopped session,
or authorize unlimited provider retries. For rate limits, outages, and failed
jobs, use the host's supported recovery mechanisms; do not silently switch to a
paid account or weaker model to keep activity going.

## Every fix becomes a PR

No fix is finished on a working tree. The sequence is fixed:

1. Branch from the remote default branch, never from unrelated local work:
   `git fetch origin && git switch -c watcher/<topic>-<short-id> origin/<default>`.
2. Bring only in-scope changes. For runner work run
   `omo-mods runner pull <repo> --to <runner>` and apply `changes.patch` and
   `untracked.tgz` on that branch; never on the base checkout.
3. Run the project's own checks (`package.json` scripts, or the commands in its
   instructions). A proposed or skipped check is not a pass.
4. Commit only the files in scope, with the evidence in the message body.
5. Push the branch and open a PR:
   `gh pr create --base <default> --head <branch> --title ... --body ...`.
6. Watch CI to a verdict without sleeping in the turn:
   `tool.monitor({ command: "gh pr checks <n> --watch --fail-fast", filter: ... })`
   or an equivalent background watch. Fix failures within the same branch, at
   most three rounds, then leave the PR and its failing check in the ledger.
7. Never merge, never force-push, never push to the base branch, never approve
   your own PR.

If `gh` is not authenticated or the remote is missing, do not invent a PR: leave
the branch and the exact missing prerequisite in the ledger.
[references/pr-ci.md](references/pr-ci.md) carries the full command set, branch
naming, and the runner-specific delivery path.

## Plain-text reporting

Use short, actionable statements rather than unattended questionnaires, written
as plain lines (not `>` quotes and not code blocks):

```text
Decision: used [choice] because [evidence]. Reversible by [step].
Pending approval: [exact action and target]. Not performed. Completed [independent work] instead.
External wait: [handle] resumes on [event]. Completed [other work] meanwhile.
Blocked branch: [failure and evidence]. Remaining dependency: [specific input or capability]. No independent work remains for this branch.
```

Keep one ledger row per session: id, directory, runner, state, action, evidence,
PR, CI verdict, pending approval, timestamp. Update a row only when its state
changes. Avoid repeating the same pending question on every wake. Never describe
an unapproved action as already done.

## Cadence

One scan per wake, then act on the newest evidence. Subscribe before waiting,
from an `eval` cell:

- OmO sessions: `tool.monitor({ type: "rpc", target: "all", description })`
  reports every session's status change (`children` for your own spawns).
- A Herdr pane or agent (host or runner SSH pane): `tool.monitor({ command:
  "herdr agent wait <pane> --timeout 3600000 && echo SETTLED", filter: "^SETTLED$" })`.
- Child tasks deliver their result on their own; don't poll `task_output`.
- CI: the `gh pr checks --watch` monitor above.

Never a fixed sleep or a foreground poll loop.

Batch independent reads and scans in one call; act on one session at a time. A
second full scan is warranted only after taking an action or when a watched
event fires. Cheaper checks (`herdr pane read`, `gh pr checks`) answer the
common follow-up questions.

## Finish or return control

Stop when the objective and its checks are satisfied, the user returns and
redirects the work, the user cancels/pauses it, or a real dependency prevents all
remaining work. For fleet work, stop when every discovered session is `active`,
`idle`, `saved`, or `archived`; every fix has a PR with a CI verdict; and every
remaining blocker is a recorded critical approval. Do not continue polishing
after completion.

On return, give a compact ledger: changes completed, checks run, PR links and CI
verdicts, decisions with reversal paths, active waits, unapplied drafts, and
pending approvals. Include exact paths and reproduction commands where relevant.
If work is fully complete, say so; if not, name precisely what is left and why.
Resume normal interactive behavior when the user returns; do not make
unattended mode a permanent global setting.

## Verification status and maintenance

This is a procedural skill, not a scheduler, permission bypass, or tool blocker.
Host behavior remains authoritative. Review the
[unattended scenarios](references/unattended-scenarios.md) when changing this
procedure or the host's question, pause, goal, or background-task behavior.
