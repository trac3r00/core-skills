# Explicit new task

Read this only for an explicit `new <task name>` or equivalent creation request.
The default is one named isolated task under the existing project group. The
user supplies a task name, not a path, branch, session UUID, or preliminary session.

## Resolve and deduplicate

1. Follow the skill's project-identity checks. Resolve the existing main-project
   workspace and main checkout using `herdr worktree list` and workspace metadata.
   Preserve the caller's pane and cwd. From a linked task, still target the main
   group so the new task is a sibling.
2. Inspect existing task labels, branches, live panes, and saved conversation
   names for this repository before creating anything. If the requested task
   already exists, reuse it through the resume flow. If no transcript exists yet,
   recover its existing shell or checkout; do not duplicate a partial creation.
   Ambiguous names need a choice between matches, not a session-ID request.
3. If the user explicitly means another independent task with the same name,
   get a distinct task label. Generate and validate a unique safe branch such as
   `omo/<task-slug>-<short-id>` with `git check-ref-format --branch`. Labels may
   retain Korean; branch slugs can use a simple ASCII name. Do not derive IDs,
   paths, or parent relationships from sidebar ordering.
4. Resolve an immutable starting commit from the main checkout's HEAD, unless
   the user selected another base. Read its status: uncommitted changes are not
   included. Report that concrete limitation if the checkout is dirty; do not
   commit, stash, reset, or copy the user's edits to make creation work.

## Create exactly one grouped child

Require a compatible Herdr server and an identified existing main workspace.
Without those, report what is missing rather than creating an unrelated root
space or running against shared files.

```bash
herdr worktree create --workspace "$HOME_WORKSPACE" \
  --branch "$NEW_BRANCH" --base "$BASE_COMMIT" \
  --label "$TASK_LABEL" --no-focus
```

Use argument arrays for the call. Let Herdr choose the checkout directory.
Do not use `workspace create`, `tab create`, `/parallel`, or another automatic
launcher as a second creation step. Do not add `--trust-repository` to bypass a
Git trust failure.

Read `.result.workspace`, `.result.root_pane`, and
`.result.workspace.worktree.checkout_path` from the response. Validate the
worktree's `repo_key` against the existing project group, its
`is_linked_worktree` flag, its separate checkout path, and the returned root pane's
cwd. Validate the branch and base commit with Git.

If the call fails or times out, inspect worktree and workspace inventory before
retrying: the first call may already have created the task. A created checkout
without a ready conversation is a partial creation to finish, not a reason to
create another child.

## Open its new conversation

Resolve the installed OmO executable. Inspect the new root pane to establish
that it is at an interactive shell and not occupied by another process.
Use the host's safe shell quoting to submit this argument sequence with
`herdr pane run` to that exact pane:

```text
<resolved-omo> --name <task-label>
```

An absolute OmO launcher avoids substituting a plain Pi installation or a shell
function.
Do not use `--continue`, `--resume`, `--session`, `--fork`, or `--rebind` for a
fresh task. Do not set model overrides or alter credentials.

Opening a conversation is not permission to perform the title's coding task.
Start it without a prompt unless the user supplied explicit work instructions.
Do not auto-install dependencies, copy secrets or untracked files, or approve
startup dialogs. Report a real missing dependency or dialog if encountered.

Subscribe to bounded startup events through the host before triggering launch.
Inspect the new pane's foreground process and OmO state/output to confirm its
actual cwd and a new conversation. Verify new transcript identity when available;
a terminal title or Herdr's agent-detected state alone is insufficient. OmO may
not persist a blank conversation until it receives content: do not send a prompt
just to force transcript creation, and report whether it is saved yet.

Focus the verified child only after it is ready. Verify the original main pane
and checkout are unchanged and no second project root was created. Report only
the task name, that it is under the existing project group, and whether its
conversation is ready/saved or still blocked.

## Future entry and lifetime

- Another `new <different task>` can be requested from any conversation in the
  project; it creates a sibling task under the same main group.
- `list`, loading the skill, and starting another conversation never implicitly
  create a task. A new conversation for an existing task must reuse its checkout;
  several conversations there still share those files.
- `resume` focuses the exact live conversation, or opens the existing checkout
  and exact saved transcript. It does not run this creation procedure.
- Do not automatically remove task checkouts or branches when a conversation
  ends. Cleanup and integration require their own user request.
