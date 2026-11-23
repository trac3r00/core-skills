# Discovering sessions

Read this when the scan misses a session, reports the wrong state, or a runner
is not listed. Every path and flag below was checked against the installed
tools or the repository source on 2026-10-24; the host's own `--help` remains
authoritative.

## The scanner

```sh
python3 <this-skill>/scripts/watcher_scan.py --json
python3 <this-skill>/scripts/watcher_scan.py --stalled-minutes 30
python3 <this-skill>/scripts/watcher_scan.py --no-runners
```

Inside this repository, `<this-skill>` is `skills/watcher`; after installation it
is `~/.agents/skills/watcher`.

Exit `0` means the scan completed; unhealthy sessions are data, not a scan
failure. `2` means bad usage. Warnings in the JSON name every inventory that
could not be read; a warning is not a clean result.

Test seams (same code path, no mocks):

| Variable | Replaces |
| --- | --- |
| `WATCHER_SESSIONS_ROOT` | `<agent dir>/sessions` |
| `WATCHER_PS_FIXTURE` | `ps` rows (`pid ppid etimes command`) |
| `WATCHER_CWD_FIXTURE` | `{pid: cwd}` from `lsof` or `/proc` |
| `WATCHER_HERDR_JSON` | `herdr agent list` output |
| `WATCHER_RUNNERS_JSON` | `omo-mods runner status --json` output |
| `WATCHER_NOW_MS` | current clock for deterministic classification |
| `WATCHER_STALLED_MINUTES` | stalled threshold (default 20) |

## Host session store

Agent directory: `OMO_CODING_AGENT_DIR`, else `SENPI_CODING_AGENT_DIR`, else
`PI_CODING_AGENT_DIR`, else `~/.omo/agent` (`src/shared/paths.ts`).

Sessions live in `<agent dir>/sessions/<key>/<timestamp>_<id>.jsonl`. The key
is the working directory with the leading slash removed and `/` replaced by
`-`, wrapped in `--`: `/home/me/repo` becomes `--home-me-repo--`.

Each file starts with a `session` event carrying `id` and `cwd`, then
`message` events with `role` and `content`. The scanner reads the first 64 KiB
for identity and the last 1 MiB for two separate values: `lastAt` (last
assistant text, for display) and `activityAt` (the newest event of any kind,
used for staleness). Reading both matters: a long transcript loses its header if
only the tail is read, and a tool-heavy turn can run for an hour without
assistant prose. A session with no readable event timestamp falls back to the
file modification time; treat that as weak evidence.

Only the newest 40 transcripts are considered. A recent transcript with no
matching process is `unattributed`, not dead: a shared RPC host can carry
several sessions under one process whose cwd is the server's, so the process
table cannot prove either liveness or death. The same applies to any transcript
whose directory has a live Herdr agent - several transcripts can share one
agent directory. Inactivity between the stalled threshold and 48 hours becomes
`orphaned` only when no process and no agent owns that directory; older
transcripts are `archived`. Raise the window in the scanner when the fleet
includes long-idle work.

## Host processes

`ps -axo pid=,ppid=,etime=,command=` is filtered to the Senpi/OmO bundle
(`senpi/dist/bundle/cli.js`, `omo`, `omo-ai`) and excludes hosts and helpers
that are not sessions: `--mode rpc`, `host-supervisor`, dashboard panes,
`lsp-daemon`, `proxy start`, `worktree launch`, `omo-mods runner`,
`omo-runner list`, `session_finder`, `watcher_scan`, `grep`, `rg`.

Working directory resolution:

- macOS: `lsof -a -p <pids> -d cwd -Fn`, reading `p<n>` then `n<path>`.
- Linux: `readlink /proc/<pid>/cwd`.

A live process with no readable transcript becomes `unknown` with a synthetic
`pid-<n>` id. Do not kill it to make the list clean.

## Herdr

`herdr agent list` prints the JSON envelope directly; there is no `--json`
flag. The scanner reads `result.agents[]` with `pane_id`, `agent`,
`agent_status`, `cwd`, `title`. Statuses are `working`, `blocked`, `idle`,
`done`, `unknown`. Use `HERDR_BIN_PATH` when set, then `PATH`.

Read a pane before intervening:

```sh
herdr pane read <pane> --source recent-unwrapped --lines 120
herdr agent get <pane>
```

Herdr reports agents, not OmO session ids. When several panes share one
directory the scanner marks the newest transcripts live but deliberately omits
`paneId`, because the mapping is not provable from directory alone. Correlate
with `herdr agent list` and `herdr pane read` before sending input. `herdr
session list` lists Herdr server sessions, not OmO conversations.

## Runners

`omo-mods runner status --json` prints an array of `RunnerStatus`:

```json
[{"runner":{"name":"omo-runner-01"},"up":true,"error":null,
  "hostname":"r1","cores":8,"load1":1.2,"availMb":8000,"omoVersion":"2026.10.16",
  "sessions":[{"id":"…","title":"…","cwd":"/srv/repo","workflow":"ulw-research",
               "last":"…","lastAt":1792880000000,"pid":123,"file":"…","live":true}]}]
```

Config: `<agent dir>/omo-mods/config-omo-runner.json`, overridable with
`OMO_RUNNER_CONFIG`. `omo-mods runner setup show` prints the active file.

The runner probe is Linux-only: it reads `/proc/loadavg`, `/proc/meminfo`, and
`/proc/<pid>/cwd`. An SSH runner on macOS or BSD will report unreadable or down
even when the host is healthy; confirm with `ssh <runner> ps` and record the
probe limitation rather than treating it as a failed session.

When `omo-mods` is not on `PATH`, run the repository entrypoint once and reuse
its output:

```sh
bun /path/to/omo-mods/bin/omo-mods.ts runner status --json > "$TMPDIR/runners.json"
WATCHER_RUNNERS_JSON="$TMPDIR/runners.json" python3 <this-skill>/scripts/watcher_scan.py --json
```

A runner session is only as alive as the Herdr SSH pane that hosts it. After a
dropped pane, the transcript remains on the runner; reopen it with
`omo --session <id>` inside the runner's repo, or use `omo-mods runner switch`.
The runner probe reports only the last assistant text timestamp, so a runner
session that is actively running tools can look older than it is; read its
pane before treating it as stalled.

## Safety

The scanner reads transcripts, which may contain secrets. Quote at most the
first 80 characters of a title or last reply in a report, and never copy a
credential, token, cookie, or key into a ledger, PR, or chat. If a secret
appears unexpectedly, stop reproducing it and report only its scope.
