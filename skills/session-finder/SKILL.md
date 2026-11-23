---
name: session-finder
description: "List live coding-agent processes (Claude, Codex, OmO) as text or JSON, with safe kill. Use for live process checks. Not for transcripts (coding-agent-sessions)."
version: 1.2.1
license: MIT
when_to_use: "Use when the user asks which coding agents are running, which client owns a process, whether an OmO host is alive, or to inspect a stuck live agent. For past sessions or transcript history, use OmO's native coding-agent-sessions skill instead; this skill does not read transcripts."
metadata:
  agentskills:
    tags: [sessions, processes, monitoring, admin, multi-agent, omo, macos]
---

# Session Finder

This is the OmO-compatible live-session tool. It scans the process table
without assuming GNU-only flags, recognizes OmO/Senpi launchers and hosts,
and reports a stable JSON shape suitable for scripts.

```bash
python3 scripts/session_finder.py
python3 scripts/session_finder.py --json
python3 scripts/session_finder.py --watch 10
python3 scripts/session_finder.py --match "my-custom-agent"
python3 scripts/session_finder.py --kill 85819
```

Resolve `scripts/` against this skill's directory. Default to one `--json`
snapshot and quote numbers from it. Exit 0 means at least one agent was found,
1 means none, 2 means a refused `--kill` or bad arguments. `--watch N` is a foreground refresh loop for
a person's terminal; from OmO, take a fresh snapshot when needed instead, or run
the watch under `tool.monitor` with a `filter` for the line you care about.

`--kill` performs a fresh provider match before sending `SIGTERM`; it refuses
unknown PIDs and never sends `SIGKILL`. Kill only with the user's explicit say
for that PID. A watch is read-only. For delegated supervision of many sessions,
use `watcher`. Historical
transcripts are intentionally outside this skill's scope.

## OmO compatibility

The detector recognizes the `omo` launcher, `omo.js`, `omo-ai`, Senpi,
`@code-yeongyu/senpi`, and the extension's session-host command paths while
excluding this helper, grep processes, and test harnesses.

Routing is split by time: running processes belong here; past sessions and
transcripts belong to OmO's native `coding-agent-sessions` skill. Earlier
releases shipped a disabled stub under that name; the installer now moves that
stub to the skill manager's restorable trash so the native skill is reachable.
