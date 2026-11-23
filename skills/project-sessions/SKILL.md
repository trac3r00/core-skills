---
name: project-sessions
description: "Create isolated Herdr task checkouts and resume their OmO chats. Use for explicit new, list, or resume. Not for transcript search (coding-agent-sessions)."
version: 0.3.0
license: MIT
compatibility: "Requires OmO, Git, Herdr for interactive resume, and the coding-agent-sessions skill with Python 3.11+ for discovery."
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [herdr, sessions, checkouts, omo, worktrees]
---

# Project Sessions

Keep the user's entry point in the main project directory. Create an isolated
task only when explicitly requested; otherwise find or reconnect conversations.
Use one existing project group, with a linked worktree child for each independent
coding task. Multiple conversations can belong to the same task; a conversation
is not a reason to create another worktree or project group.

This is an agent-assisted workflow, not a modification to OmO's native session
picker. The main pane stays in place; new and resumed processes run in their
task's checkout under that group. Never promise independent file versions in one
physical directory, or arbitrary extra levels of Herdr sidebar nesting.

## When native is enough

Use OmO's native picker (`/resume`, `omo -r`) when the conversation belongs to
the current checkout and the user only wants to reopen or continue it there.
Use the native `coding-agent-sessions` skill when the request is a read-only
search across past transcripts. Neither can create an isolated task checkout or
bind a conversation to an existing Herdr project group - that is the only reason
to load this skill. If a native picker already shows the exact conversation in
the right directory, do not duplicate its work; report the native route instead.

## Inputs and boundaries

- Accept `new <task name>`, `list`, `resume <task or conversation>`, or an
  equivalent natural-language request, including Korean. Loading the skill,
  naming it without an action, or asking how it works creates nothing.
- Route an explicit `new` request to [references/new-task.md](references/new-task.md)
  after establishing the project below. A title alone does not authorize coding.
  Without an explicit creation request or a clear resume target, list first.
- Default to the repository containing the caller's directory. Accept an explicit
  project path; never require the user to enter a worktree or supply a UUID.
- Read the installed `herdr` and `coding-agent-sessions` skills before using them.
  Read `git-master` when the host provides it before running Git.
- A request to list is read-only. `new` authorizes one isolated task checkout and
  its new conversation; `resume` reuses the selected task and conversation.
  Neither authorizes sending a coding prompt, approving dialogs, or changing
  existing code unless the user also explicitly requests that work.
- Never delete, relocate, rewrite, fork, or rebind transcripts as a navigation
  shortcut. Do not change branches, merge, recreate worktrees, or prune history
  unless the user separately requests that operation.

## 1. Establish the project

Use Git's identity, not the directory name or branch name:

```bash
GIT_MASTER=1 git -C "$PROJECT" rev-parse --show-toplevel
GIT_MASTER=1 git -C "$PROJECT" rev-parse --path-format=absolute --git-common-dir
GIT_MASTER=1 git -C "$PROJECT" worktree list --porcelain -z
```

Parse NUL-delimited worktree records. Resolve real paths for comparisons. Record
the common Git directory, each registered checkout, branch or detached HEAD, and
whether its directory exists. The familiar project folder need not be on `main`;
do not switch it.

Check `HERDR_ENV` first. When it is `1`, record the caller's workspace, tab, pane,
and working directory. Otherwise discover the server read-only and use only
explicit target IDs. Check `herdr status --json` and installed subcommand help
before relying on version-sensitive syntax.

Under Herdr.app (`HC_TERMINAL_ID` set, `HERDR_ENV` unset) the `herdr` CLI does not reach the window.
Open task spaces with `herdr-app do space.new` or `tab.new`, and use hc terminal
addresses (`t7`) wherever this skill says pane ID. See `herdr-app --skill`.

Resolve the existing main-project workspace with `herdr worktree list` and
workspace inventory. Match common Git directory / `worktree.repo_key`, not labels.
If invoked inside a linked checkout, resolve its main-project group first: another
new task must be a sibling under that group, not a child of the current task.
Do not create a second root workspace merely to perform this workflow.

## 2. Discover conversations, not just live panes

Resolve `scripts/find-agent-sessions.py` relative to the installed
`coding-agent-sessions` skill, not this skill or the project directory. Read that
skill's Senpi reference and inspect the finder's CLI if its syntax has changed.

List saved OmO/Senpi sessions globally, using the `senpi` platform. Include the
actual configured session store through `--root` when it is nonstandard. Normal
stores are outside the checkout, under `~/.omo/agent/sessions/` and related
Senpi/Pi roots, with directory-based grouping.

Example discovery command after resolving `FINDER`:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 "$FINDER" list \
  --platform senpi --limit 200 --workers 4
```

The finder limits results BEFORE this skill's repository filtering. If the result
count reaches the requested limit, increase the limit or query individual
registered checkout paths; do not treat a capped global list as complete.
`--cwd` is a substring filter, not proof of repository membership. Resolve and
validate every returned working directory.

For each candidate, retain its exact transcript path, UUID, recorded working
directory, name or first prompt, and last activity. Use the reader to inspect a
candidate when its identity or task is unclear.

Classify membership:

1. A recorded directory inside a registered checkout belongs to this project.
   For existing directories, confirm the resolved common Git directory matches.
2. An existing directory outside that list belongs only if its common Git
   directory matches. A similarly named clone is a different local repository.
3. A missing directory listed in the worktree inventory can be shown as
   `checkout missing`. A pruned/deleted checkout without retained repository
   evidence is `membership unverified`, even if its path looks familiar. Show
   such possible historical matches separately; never auto-resume them.

Query `herdr worktree list` and `herdr agent list` to add task and live-pane
information. Include registered tasks with no saved conversation yet, so a
partially completed creation is recoverable. Inventory supplements saved history;
it does not replace it. Do not equate a matching title or working directory with
a matching conversation UUID. Several conversations in one checkout share files;
they are not independent simultaneous coding sandboxes.

Show a short numbered list with:

```text
Task / conversation | Last active | Branch | Running / saved / checkout missing
```

Keep UUIDs and absolute paths in the internal selection map. The user can choose
by task name or row number. If a name is ambiguous, ask which matching row they
mean; do not ask them to find a session ID.

## 3. Resume the selected conversation

Recheck the selected transcript and checkout immediately before launching.
Resolve the actual OmO launcher from the installed environment; do not substitute
a plain Pi launcher that may omit OmO's configuration.

### Already running

Establish exact identity using process arguments, reported native session
metadata, or the host's session-owner information. Resolve paths and IDs against
the selected transcript. If the selected conversation is already running, focus
its existing tab or agent instead of opening it again.

If an agent is running in that checkout but its exact conversation cannot be
established, inspect further or ask which live conversation to use. Never launch
a possible duplicate simply because Herdr omits native session metadata.

### Saved conversation with an existing checkout

Reuse the task's existing child workspace. If its checkout is registered but its
workspace is closed, reopen that existing checkout under the main-project group:

```bash
herdr worktree open --workspace "$HOME_WORKSPACE" \
  --path "$TASK_CHECKOUT" --no-focus
```

This is `open`, not `create`: do not create another branch, checkout, or root
group. Read returned IDs and check existing agents before opening anything else.
Reuse a verified idle shell at the recorded cwd; otherwise create a tab inside
that same task workspace with `--cwd "$SESSION_CWD" --no-focus`. Sessions recorded
in the main checkout use the existing main workspace instead.

In the verified shell, use `herdr pane run` to start the resolved OmO launcher with
`--session` and the exact absolute transcript path.
Shell-quote every argument; do not interpolate task text into a shell command.

Do not use `--continue`, an ambiguous UUID prefix, `--fork`, `--rebind`, or a shared
`--session-dir` to approximate resuming the selected session. The process cwd
must match its saved checkout, not the main folder.

Observe startup with a subscription, not a sleep: from `eval`, run
`tool.monitor({ command: "herdr agent wait <pane> --timeout 120000 && echo READY", filter: "^READY$" })`
(or `hc wait <t>` under Herdr.app). Then inspect the new pane's
`herdr pane process-info --pane <pane>` and OmO startup output. Verify the selected conversation's
identity and actual working directory; agent detection alone is not proof.
If a dialog appears, report it and follow the host's interaction rules. Do not
answer it automatically.

Once verified, focus the new tab for the requested resume. The original main
pane and its cwd remain unchanged.

### Missing checkout or unavailable terminal

Keep the saved conversation visible, but report that its original files are
unavailable. Never silently resume against the main checkout. Offer a separate,
explicit recovery decision: restore a known branch into an isolated checkout,
or inspect the transcript without executing its tasks. A branch cannot restore
discarded uncommitted files.

If Herdr is unavailable, listing and a resume preview can still finish. Report
interactive resume as unavailable rather than claiming a command preview is an
opened conversation.

## Checks and reporting

- `list` is complete when the project-scoped candidates are shown and truncation,
  inaccessible stores, or uncertain historical membership are explicitly stated.
- `new` is complete only after one named task is linked to the existing project
  group, its code checkout is separate, and its new OmO conversation is ready.
  Verify the main pane and checkout are unchanged. See the creation reference.
- `resume` is complete only when the exact selected conversation is visible in
  its correct checkout and the main pane remains in its original directory.
- Never send a work prompt merely to test a resumed session.
- If startup fails, inspect the created pane before retrying. Keep it for
  diagnosis; report its ID rather than closing unrelated panes.
- Report the conversation name, branch/checkout status, and opened tab or reused
  pane. State any identity or startup check that remains unverified.
- Explain deletion accurately: ordinary worktree removal does not itself remove
  transcripts in the separate session store, but it can remove code needed for
  a faithful resume. Never promise that cleanup hooks preserve every artifact.

## Invocation and maintenance

```text
/skill:project-sessions new fix-login
/skill:project-sessions list
/skill:project-sessions resume the gateway conversation
```

Korean requests also work (`새 작업으로 "로그인 수정" 열어줘`). After installation run `/reload` or start a new session. This does
not change bare `omo -r` or the native `/resume` picker.

[references/evidence.md](references/evidence.md) carries the verified mechanisms
and limits. Recheck after a session-format, Herdr, or session-finder change.
