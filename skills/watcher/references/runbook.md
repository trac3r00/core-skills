# Blocker runbook

Every entry has one reversible action and one stop boundary. Apply the action
only after confirming the evidence on the real surface; record what you saw.
Anything listed as pending stays pending without a question while the user is
away.

## Blocked on an approval or question

1. Read the pane (`herdr pane read <pane> --source recent-unwrapped --lines 120`).
2. Compare the request with the user's current instruction and the handoff
   checkpoint.
3. If the existing instruction answers it, answer exactly that and record the
   decision plus how to reverse it.
4. Otherwise write `Pending approval: <exact action and target>. Not performed.`
   and continue independent work.

Never approve a merge, deploy, purchase, credential change, destructive delete,
force-push, or message to a person on the user's behalf.

## Paused or timer-held

`/pause` and a set `/timer` are the user's controls. Do not resume, clear, or
route around them. Finish observation and leave `Paused by user` in the ledger.

## Rate limit, quota, or provider outage

Check the usage dashboard or `omo-mods` status first. Retry the same session
after the window resets or the provider recovers; use the configured fallback
chain, never a silent account switch. If the session reports a hard quota
exhaustion, leave it pending and pick independent work.

## Authentication or expired login

Do not read, print, or copy credentials. If `gh auth status`, a provider login,
or a runner's `auth.json` is missing, record the exact prerequisite and stop
that branch. A token broker is the user's infrastructure, not something to
repair unasked.

## Context exhaustion or compacted session

The session may continue after compaction. Read the pane and resume only if it
is actually stuck. If continuing would cross a scope or spend boundary, leave
it pending.

## Stalled turn

Distinguish a long tool run from a loop: check the last tool call and its
duration. For a loop, interrupt once, then send a concrete continuation on the
same session. Do not interrupt a build, test, or CI wait that is still
producing output. If two interrupts do not move it, leave the evidence and move
to another session.

## Crashed or vanished process

If the transcript is recent and the work is unfinished, resume with
`omo --session <id>` in the recorded directory. If the user had paused it, do
not resume. Confirm the new process appears in the next scan.

## Orphaned transcript

A transcript is not a task. Resume only when its last assistant message ends
with unfinished work or the user named that session. Otherwise leave it.

## Dirty worktree or overlapping changes

Never stash or discard another session's work. Create the watcher branch from
the remote base, apply only the files the fix needs, and leave unrelated
changes alone. If the fix depends on uncommitted work from another session,
stop that branch and record the dependency.

## Failing CI

Read the failing job log, reproduce the command locally, fix within the branch,
and push. Three rounds maximum, then leave the PR open with the failing check
and the log path in the ledger. A flaky failure is still a failure until a
rerun passes; never mark it green by skipping the test.

## Runner down or unreachable

Try another configured runner for new work. Record `runner <name> DOWN
(<error>)`. Do not repair infrastructure, reboot a host, or rotate tokens unless
the user asked for that repair. A down runner is not proof its sessions died;
check `omo --session` reachability when the host is back.

## Runner probe unreadable on a non-Linux host

The probe needs `/proc`. Report the limitation, use an SSH check for liveness,
and fetch its work through `omo-mods runner pull` when the pane is reachable.

## No Herdr or no omo-mods on PATH

The scanner still reports host processes and transcripts; Herdr attention and
runner rows are absent with warnings. Use the fallbacks in
[discovery](discovery.md) before claiming the fleet is healthy.

## Missing remote or GitHub authentication

Leave the branch pushed locally or unpushed as appropriate, record `gh` or
remote prerequisite, and never fabricate a PR URL. If the push itself needs a
credential, stop that branch and continue elsewhere.

## Port or resource conflict

Use `sys-health` before blaming code. Do not kill a process that belongs to
another session or the user; record the conflict and choose a different port or
runner for watcher-owned work.

## Two sessions on the same task

Do not start a duplicate agent in the same write scope. Check the scan and
Herdr panes first. If a duplicate already exists, stop the newer watcher-owned
one after its work is captured, never the user's.
