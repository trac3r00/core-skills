---
name: herdr
description: "Drive Herdr panes, tabs, agents, and worktrees via the herdr CLI. Use when a Herdr pane or agent must be read or driven. Not for process lists (session-finder)."
version: 1.1.0
license: MIT
metadata:
  agentskills:
    tags: [herdr, terminal, multiplexer, panes, agents, orchestration, socket-api, cli]
---

# Herdr

Herdr is a terminal workspace manager for coding agents: **workspaces -> tabs -> panes**.
It recognizes the agent in a pane, tracks its state (`idle`, `working`, `blocked`, `done`,
`unknown`), and exposes everything through the `herdr` CLI and a Unix-socket JSON API.
With it you can run commands in sibling panes and drive other agents the way a person would.

Read a reference only when the task needs it:

| File | Read when |
|------|-----------|
| [`references/cli-reference.md`](references/cli-reference.md) | You need a subcommand or flag not shown below |
| [`references/recipes.md`](references/recipes.md) | Worktrees, `--machine` remotes, named sessions, notifications, diagnosis |
| [`references/api.md`](references/api.md) | Talking to the socket directly, event subscriptions, error codes |
| [`references/config.md`](references/config.md) | Editing `config.toml`, keybindings, themes |
| [`references/integrations.md`](references/integrations.md) | Installing or checking agent-state integrations |

## 1. Environment gate (always first)

```bash
test "${HERDR_ENV:-}" = 1 && echo "pane $HERDR_PANE_ID" || echo "not inside Herdr"
```

- **Inside Herdr.** You have caller context: `HERDR_PANE_ID`, `HERDR_WORKSPACE_ID`,
  `HERDR_TAB_ID`, `HERDR_SOCKET_PATH`, `HERDR_BIN_PATH`. Prefer `--current` and treat
  your pane as home base.
- **Outside Herdr.** The CLI still reaches the default socket (`~/.config/herdr/herdr.sock`),
  so read-only discovery and explicit-ID control work. There's no `--current`, and the
  UI-focused pane may belong to the user. Always pass explicit `--pane`/`--workspace`/`--tab`
  IDs and never infer targets from sidebar order.
- **Herdr.app instead.** `HC_TERMINAL_ID` set and `HERDR_ENV` unset means the macOS app
  over herdr-core. Terminals are `t7`-style addresses, the window is driven by `herdr-app`
  (`ls`, `status`, `commands`, `do <cmd>`), terminals by `hc` (`ls`, `get`, `read`, `send`,
  `keys`, `interrupt`, `wait`, `events`). This skill's `herdr` commands don't apply; read
  `herdr-app --skill` and `hc --skill`. If both env sets exist, terminal Herdr is the host.

Never run bare `herdr` (it attaches the interactive TUI) and never probe a mutating
command by dropping arguments: `herdr workspace create` runs with defaults. Use
`herdr <group> [<sub>] --help` for discovery.

## 2. Mental model

| Object | Example | Notes |
|--------|---------|-------|
| Workspace | `w1`, `w1J` | Directory-scoped sidebar space |
| Tab | `w1:t1` | Workspace-qualified |
| Pane | `w1:p1` | Hosts a terminal, maybe an agent |

IDs are opaque; closed IDs are never reused. Read IDs from creation responses, never
predict them: `workspace create` -> `.result.workspace`, `.result.tab`, `.result.root_pane`;
`tab create` -> `.result.tab`, `.result.root_pane`; `pane split` -> `.result.pane.pane_id`.

**Pane vs agent.** Use pane commands for shells, tests, servers, and log tails. Use agent
commands when Herdr must check agent identity or state. An agent target is a unique live
agent name (`[a-z][a-z0-9_-]{0,31}`) or the hosting pane ID, never a kind label like
`claude`. A name is cleared when that agent exits or is replaced.

**States.** `idle` and `done` both mean ready for input. `blocked` means Herdr saw an
approval or question dialog. `unknown` is an unclassified agent and is **not** proof of
completion.

**Defaults.** An omitted `pane split` target means your own pane when `HERDR_PANE_ID`
exists. Other commands may default to the UI-focused pane, which can be someone else's.
Be explicit for anything that writes.

## 3. Waiting from OmO: subscribe, don't sleep

Herdr's own waits block until the condition holds, so they are the event. From an OmO
`eval` cell, run them under `tool.monitor` and keep working; the watch wakes the turn:

```js
tool.monitor({ description: "tests in sibling pane",
  command: `herdr pane wait-output ${pane} --match "passed" --timeout 600000 && echo HERDR_READY`,
  filter: "^HERDR_READY$" })
```

Same shape for `herdr agent wait <target> --timeout <ms>` (default matches `idle`, `done`,
or `blocked`) and `herdr agent prompt <target> "<text>" --wait --timeout <ms>`. Always pass
`--timeout`: without it these wait forever. Never write `sleep` loops or repeated
`pane read` polls. For many agents at once, the socket's `events.subscribe` stream is the
single subscription (see `references/api.md`).

## 4. Recipes

### Run a command in a sibling pane, keep the user's focus

```bash
herdr pane layout --pane "$HERDR_PANE_ID"          # wide -> right, tall -> down
herdr pane split --current --direction right --cwd "$PWD" --no-focus   # read .result.pane.pane_id
herdr pane run "$NEW" "pytest -q"                   # text plus Enter, atomically
herdr pane wait-output "$NEW" --match "passed" --timeout 120000
herdr pane read "$NEW" --source recent-unwrapped --lines 120
```

`wait-output` checks existing output first, then keeps checking; `--match` is a literal
substring, `--regex` a Rust regex, `--source` is `visible|recent|recent-unwrapped`. Don't
stack same-direction splits into unusable slivers.

### Start another agent and give it work

```bash
herdr agent start reviewer --kind codex --pane "$NEW"      # pane must sit at a shell prompt
herdr agent prompt reviewer "Review the staged diff; report only actionable findings." \
  --wait --timeout 120000
herdr agent read reviewer --source recent-unwrapped --lines 120
```

`agent start` creates no layout and returns once the agent is detected and ready
(default 30 s, max 300 s); pass native agent flags after `--`.

`agent prompt` outcomes:

- `agent_blocked`: the agent was already at a dialog, nothing was sent. Read the screen
  and ask the user before answering it.
- `agent_prompt_stalled`: no `working`/`blocked` within 5 s of submission.
- `timeout`: your `--timeout` expired first.
- It doesn't track turns. If the agent was already working, that turn's end may match.

A stall or timeout doesn't prove the prompt wasn't delivered: run `agent get` and
`agent read` before retrying. Keys go through `herdr agent send-keys <target> esc`
(validated before any byte is written). Catch an agent asking for input with
`herdr agent wait <target> --until blocked --timeout <ms>`.

### Read output well

`--source visible` (viewport), `recent` (default, soft wraps kept), `recent-unwrapped`
(best for logs), `detection` (the bottom-buffer text Herdr classifies; `pane read` only).
`--lines N` pulls more scrollback, `--format ansi` keeps styling, `--raw` keeps escapes.
If a large read still misses the answer, have the agent write its report to a temp
Markdown file and reply with the path.

## 5. Socket API in one screen

Every CLI verb wraps one socket method, one JSON object per line:

```json
{"id":"cli:pane:get","method":"pane.get","params":{"pane_id":"w1:p1"}}
{"id":"cli:pane:get","result":{"type":"pane_info","pane":{"pane_id":"w1:p1","agent_status":"idle"}}}
{"id":"cli:pane:get","error":{"code":"pane_not_found","message":"pane w99:p9 not found"}}
```

`herdr api schema --json` is the authority on methods; `herdr api snapshot` returns live
`{agents, panes, tabs, workspaces, layouts, focused_*}`. Exit codes: `0` ok, `1` server
error, `2` syntax.

## 6. Safety

- `--no-focus` for background work unless the user asked to switch context.
- Target with `--current`, an explicit ID, or a unique agent name.
- Don't close workspaces, tabs, panes, or sessions you didn't create. `workspace.close`'s
  `close_group` also closes linked worktree workspaces; never add it just to get past
  `workspace_group_close_required`.
- Never answer another agent's dialog, stop the server, or kill the main Herdr process
  without the user's explicit say.
- After an update, client and server versions can differ. Check `herdr status --json`
  before relying on new features; a missing method isn't permission to restart the server.

## Verified environment

Checked on 2026-11-08 with read-only `--help` and `status --json`: `herdr 0.9.5`, client
and server protocol **22**, server capabilities `live_handoff`, `surface_interest`,
`health_check`, `ssh_agent_registration` (`detached_server_daemon` false), macOS arm64,
socket `~/.config/herdr/herdr.sock`. `hc` and `herdr-app` help match the Herdr.app notes
above. Re-run `herdr --version` and `herdr api schema --json` after an update.
