# Herdr recipes: worktrees, remote machines, named sessions, diagnostics

Read this when the task involves a Git worktree workspace, a saved SSH machine, an
isolated named session, or diagnosing why Herdr classified an agent a certain way.
Flags are checked against `herdr <group> <sub> --help`; the binary wins over this file.

## Git worktree workspace

```bash
herdr worktree list --cwd "$PWD"
herdr worktree create --workspace "$HERDR_WORKSPACE_ID" --branch feat/x --base main --no-focus
herdr worktree open --path ~/src/repo/.worktrees/x
herdr worktree remove --workspace <ws> [--force]
```

`--trust-repository` grants per-request Git trust. Use it only after the user has
verified the repository, never as a retry for a failed command. Worktree actions need
the workspace to live inside a Git work tree (`not_git_worktree` otherwise).

## Remote machines

```bash
herdr machine list --json
herdr --machine <label-or-id> agent list
herdr --machine <label-or-id> pane list
herdr --machine <label-or-id> agent prompt <remote-agent> "status?" --wait --timeout 120000
```

The selector is an enabled saved profile ID or a unique case-sensitive label, not an
arbitrary SSH hostname. Don't combine `--machine` with `--session` or `--remote`. IDs
are per-server: two machines can both own `w1:p1`. Forwarding needs the remote server
to already run an API-compatible version. It never installs, starts, or restarts one,
and never falls back to the local session. Local config, session management, installs,
and interactive attach aren't forwarded. A connection failure doesn't prove a mutation
didn't happen, so inspect remote state before retrying. Add, remove, enable, or disable
profiles only when the user asks. `machine add` uses the remote default session unless
`--remote-session` is given.

## Named sessions (isolation)

```bash
herdr session list --json
herdr --session scratch pane list            # use or create a named session
herdr session stop scratch                   # then:
herdr session delete scratch                 # only stopped sessions delete
```

Use a named session for experiments that need an isolated server. Never run
`herdr server stop` from an active session unless the user explicitly wants the server
and its pane processes stopped.

## Notify, inspect, diagnose

```bash
herdr notification show "Build finished" --body "12 tests green" --sound done   # --sound none|done|request
herdr api snapshot                      # whole live session in one JSON document
herdr status --json                     # client/server versions, protocol, compatibility
herdr agent explain <target> -v         # why Herdr classified an agent that way
herdr server agent-manifests --json     # active detection manifest versions
herdr config check                      # validate config.toml
```

Keep `notification show` for real user-facing milestones, not progress chatter.

## Moved panes

A pane moved to another workspace gets a new workspace-qualified ID. Read it from
`.result.move_result.pane.pane_id`; the old value is `.result.move_result.previous_pane_id`,
kept alive only for the moved process's inherited caller context.
