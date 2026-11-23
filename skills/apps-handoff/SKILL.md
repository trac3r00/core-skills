---
name: apps-handoff
description: "Resume an OmO desktop thread in a CLI terminal with its full history. Use for $apps-handoff <id>. Not for CLI session resume (project-sessions)."
version: 1.0.1
license: MIT
metadata:
  agentskills:
    tags: [omo, desktop, cli, sessions, handoff, herdr, macos]
---

# Apps Handoff

`$apps-handoff <thread-id-or-prefix>` continues the existing desktop conversation
in a new terminal surface. It reuses the exact Senpi v3 JSONL, not a summary,
fork or imported copy. Resolve script paths relative to this skill directory.
Requires Node.js, `omo`, and either Herdr or macOS Terminal. No packages or network
access are needed; the live-state query talks to local OmO endpoints.

## Resolve, open, verify

1. Run the read-only resolver:

   ```bash
   node scripts/apps-handoff.mjs resolve <id-or-prefix> --json
   ```

   Read `threadId`, `sessionPath`, `selection`, `cwd`, `cwdExists`, `messageCount`,
   `entryCount`, `lastActivity`, `goal`, `live`, `strategy`, `command`, `blocked`,
   `requiresForce`, and `permissionPreset`.
   Counts describe all valid records in the current file (entries exclude its
   header); they are not a count of only the active conversation branch.
   Do not print conversation/tool contents or read lease files: leases contain tokens.

2. If `strategy` is `already-open`, stop: report the existing terminal's
   PID/socket from `live`, cwd, counts and goal. A TUI wins even if a desktop host
   also lists the thread. Never duplicate it, including when `--force` is supplied.

3. Otherwise run `open` with the resolved full ID:

   ```bash
   node scripts/apps-handoff.mjs open <full-id>
   ```

   It resolves again, then creates a focused Herdr tab in `HERDR_WORKSPACE_ID`
   when `HERDR_ENV=1`, or a new macOS Terminal window otherwise. It parses Herdr's
   `.result.root_pane.pane_id` and runs the command in that pane. Do not run
   adoption in the agent's own terminal; that would replace its process.
   Always show the returned exact `command` as the manual alternative.

   `adopt` uses native `omo daemon adopt`, letting the host flush and release the
   session before interactive resume. `resume` runs `cd <cwd> && omo --session
   <exact-file> --session-dir <parent> --permission-preset full-access`.
   Do not copy or rewrite desktop data, replay messages, or recreate its goal.

4. `dispatched: true` means a command was sent, **not** proof that the CLI opened.
   Subscribe instead of sleeping: from `eval`, `tool.monitor({ command:
   "herdr agent wait <pane> --timeout 120000 && echo READY", filter: "^READY$" })`.
   Then read the new Herdr pane (or ask the user to check the Terminal window) and
   query `omo thread list --all-scope --json` to confirm a TUI for this full ID.
   Confirm to the user: thread ID, surface/pane, cwd, message count, and goal
   objective/status (or no goal). Continue work in that new session; do not send
   another task prompt from this one. If startup is not observable, say
   "dispatched; startup unverified" rather than claiming success.

## Refusals and recovery

| Result | Action |
|---|---|
| `ambiguous_prefix` | Show candidate IDs and ask for a longer prefix. |
| `unknown_id` | Ask for the desktop thread ID; do not substitute a similar chat. |
| `missing_cwd` | Show the recorded cwd and offer native `omo --rebind` to a user-chosen directory. Do not silently change cwd or edit the header. |
| `attached` / `requiresForce` | Ask before retrying `open <id> --force`; it disconnects an attached desktop/client. |
| Native `turn_active` | Ask before retrying `open <id> --interrupt`; it stops the active turn. Preserve queued-message notices shown by native adoption. |
| Native `already_terminal` | Resolve again and report where it is; do not duplicate. |
| Native `not_running` / `unknown_session` | Resolve again. Only use the returned direct resume command after fresh state says `resume`. |
| Native `session_busy`, draining/closing host | Report the refusal; resolve again when the user retries. Do not add force/interrupt automatically. |
| `live_state_unavailable`, conflicting paths, invalid metadata | Stop and report the error. Never infer "not running" from a failed query. |

Native adoption has no permission-preset flag: it inherits native global/project
settings. The resolver reports the global preset; check project settings before
claiming full access. If an override restricts tools, explain it and have the user
choose the full-access preset in the new CLI; never silently edit settings.

## Goal store and compatibility

Verified against OmO 5.1.51 / Senpi 2026.10.27-1: `SessionManager.open(path)`
derives `getSessionDir()` from `dirname(path)` unless explicitly overridden.
`goal/store-ref.js` uses that directory plus `extensions/goal/<header-id>.json`.
Desktop's install directory is the transcript parent, so the goal carries over
without copying. Direct resume pins `--session-dir` to that parent to defeat
inherited environment/settings overrides. Native adoption relaunches with
`--session` only, so its command sets `OMO_CODING_AGENT_SESSION_DIR` to the same
parent for that process. OmO's launcher preserves this environment variable,
which takes precedence over settings. The goal file has a version-1 envelope:
`{"version":1,"goal":{...}}` (or `goal:null`). Recheck these contracts on engine upgrades.

## Helper interface

Both subcommands emit JSON, including errors; `resolve --json` makes the contract
explicit. `open` supports `--interrupt`, `--force`, `--dry-run`, and
`--surface herdr|terminal|print`. Dry-run and print never open a surface or release
a session. An already-open result has `command: null` deliberately.

```bash
node scripts/apps-handoff.mjs open <id> --dry-run --surface print
node --test test/
```

Exit codes: **0** resolved/dispatched/printed/already-open; **2** bad arguments;
**3** unknown or ambiguous ID; **4** missing cwd, required force or missing Herdr
workspace; **5** unavailable live state, invalid data or surface/IO failure.
Missing-cwd resolve still includes its metadata and exits 4.
After dispatch, native refusal/CLI exit is visible in the new terminal, not the
helper's exit status. If surface creation fails, use the resolve command as the
manual fallback; do not claim the session opened.

Discovery reads `~/Library/Application Support/omo-desktop/omo-data-home.json`,
then falls back to `~/.omo/desktop` when absent. `OMO_DESKTOP_HOME` overrides it.
Only `.jsonl` files directly under install directories are candidates; live
`sessionPath` wins, otherwise newest mtime with a stable path tie-break.
`OMO_HANDOFF_THREAD_LIST=<json-file>` substitutes a fixture array for the live query.
Unset it for real use. Imported helpers also accept an `execute(file, argv)`
function for isolated surface tests. Neither path reads lease contents.
