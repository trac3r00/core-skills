#!/usr/bin/env python3
"""Enumerate OmO sessions on this host and on configured omo-runner hosts.

Read-only: it never stops, prompts, or edits a session. Output is one JSON
document with --json, else a human table. Test seams are environment variables
so the same code path runs in fixtures and on a real Mac/Linux host:

  WATCHER_SESSIONS_ROOT   session store root (default: <agent dir>/sessions)
  WATCHER_PS_FIXTURE      file with "pid ppid etimes command" lines instead of ps
  WATCHER_CWD_FIXTURE     JSON object {pid: cwd} instead of lsof//proc
  WATCHER_HERDR_JSON      file with `herdr agent list --json` output
  WATCHER_RUNNERS_JSON    file with `omo-mods runner status --json` output
  WATCHER_NOW_MS          fixed clock in milliseconds (tests)
  WATCHER_STALLED_MINUTES stalled threshold (default 20)

Exit codes: 0 scan completed (unhealthy sessions are data, not a scan failure),
2 bad usage. Every external command is bounded and a failure becomes a warning.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

OMO_PROCESS = re.compile(
    r"(?:\bomo(?:\.js)?\b|\bomo-ai\b|@code-yeongyu/senpi|senpi/dist/bundle/cli\.js)"
)
NOT_A_SESSION = re.compile(
    r"(?:--print\b|--mode\s+rpc\b|host-supervisor|dashboard\b|lsp-daemon|"
    r"proxy\s+start|omo-mods\s+runner|omo-runner\s+list|worktree\s+launch|omo-mods\.js|"
    r"session_finder|watcher_scan|\bgrep\b|\brg\b)"
)
DESTRUCTIVE = re.compile(
    r"(?:force[- ]push|drop\s+table|rm\s+-rf|delete\s+(?:the\s+)?(?:branch|repo|worktree)|"
    r"merge\b|publish\b|deploy\b|purchase|pay\b|credit card|password|api key|sudo\b)",
    re.IGNORECASE,
)
ERROR_HINTS = re.compile(
    r"(rate limit|quota|usage limit|credits? exhausted|context (?:window|length)|"
    r"provider (?:error|unavailable|outage)|authentication|unauthorized|401|403|429|500|502|503|504)",
    re.IGNORECASE,
)


def run(argv: list[str], timeout: float = 5.0) -> tuple[int, str, str]:
    try:
        done = subprocess.run(
            argv, capture_output=True, text=True, timeout=timeout, check=False
        )
        return done.returncode, done.stdout, done.stderr
    except FileNotFoundError:
        return 127, "", f"{argv[0]} not found"
    except subprocess.TimeoutExpired:
        return 124, "", f"{argv[0]} timed out after {timeout}s"


def agent_dir() -> Path:
    for key in ("OMO_CODING_AGENT_DIR", "SENPI_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"):
        value = os.environ.get(key)
        if value:
            return Path(value).expanduser()
    return Path.home() / ".omo" / "agent"


def session_key(cwd: str) -> str:
    return "--" + cwd.lstrip("/").replace("/", "-") + "--"


def read_head(path: Path, limit: int = 65_536) -> str:
    with path.open("rb") as handle:
        return handle.read(limit).decode("utf-8", errors="replace")


def read_tail(path: Path, limit: int = 1_048_576) -> str:
    size = path.stat().st_size
    with path.open("rb") as handle:
        if size > limit:
            handle.seek(size - limit)
        data = handle.read()
    return data.decode("utf-8", errors="replace")


def stamp_ms(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value if value > 1e11 else value * 1000)
    try:
        return int(datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000)
    except (ValueError, TypeError):
        return 0


def parse_session(path: Path) -> dict[str, Any] | None:
    try:
        text = read_head(path) + "\n" + read_tail(path)
    except OSError:
        return None
    identifier = cwd = title = workflow = last = ""
    last_at = activity_at = 0
    for raw in text.splitlines():
        if not raw.startswith("{"):
            continue
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            continue
        activity_at = max(activity_at, stamp_ms(event.get("timestamp")))
        kind = event.get("type")
        if kind == "session":
            identifier = str(event.get("id") or identifier)
            cwd = str(event.get("cwd") or cwd)
            continue
        if kind == "session_name" and isinstance(event.get("name"), str):
            title = event["name"]
            continue
        message = event.get("message")
        if kind != "message" or not isinstance(message, dict):
            continue
        content = message.get("content")
        if isinstance(content, str):
            text_value = content
        elif isinstance(content, list):
            text_value = " ".join(
                str(part.get("text", ""))
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            )
        else:
            text_value = ""
        role = message.get("role")
        if role == "user":
            skill = re.search(r'invoked the "([^"]+)" skill', text_value)
            if skill:
                workflow = skill.group(1)
            if not title and text_value and not re.match(
                r"^\[Answer to question|^<omo-senpi-task>|^Continue working toward",
                text_value,
            ):
                title = " ".join(text_value.split())[:80]
        elif role == "assistant" and text_value.strip():
            last = " ".join(text_value.split()).strip()[:200]
            last_at = max(last_at, stamp_ms(event.get("timestamp")))
    if not identifier:
        return None
    if not last_at:
        last_at = int(path.stat().st_mtime * 1000)
    if not activity_at:
        activity_at = last_at
    return {
        "id": identifier,
        "cwd": cwd,
        "title": title,
        "workflow": workflow or None,
        "last": last,
        "lastAt": last_at,
        "activityAt": activity_at,
        "file": str(path),
    }


def ps_lines() -> list[str]:
    fixture = os.environ.get("WATCHER_PS_FIXTURE")
    if fixture:
        return Path(fixture).read_text(encoding="utf-8").splitlines()
    code, out, _ = run(["ps", "-axo", "pid=,ppid=,etime=,command="], timeout=8)
    return out.splitlines() if code == 0 else []


def process_rows(lines: list[str]) -> list[dict[str, Any]]:
    rows = []
    for line in lines:
        parts = line.strip().split(None, 3)
        if len(parts) < 4:
            continue
        pid, ppid, etimes, command = parts
        if not pid.isdigit() or not OMO_PROCESS.search(command) or NOT_A_SESSION.search(command):
            continue
        rows.append(
            {
                "pid": int(pid),
                "ppid": int(ppid) if ppid.isdigit() else None,
                "elapsedSeconds": parse_etime(etimes),
                "command": command,
            }
        )
    return rows


def parse_etime(value: str) -> int | None:
    match = re.fullmatch(r"(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)", value or "")
    if not match:
        return None
    days, hours, minutes, seconds = (int(part or 0) for part in match.groups())
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def cwd_map(pids: list[int]) -> dict[int, str]:
    fixture = os.environ.get("WATCHER_CWD_FIXTURE")
    if fixture:
        try:
            raw = json.loads(Path(fixture).read_text(encoding="utf-8"))
            return {int(key): str(value) for key, value in raw.items()}
        except (OSError, ValueError, TypeError):
            return {}
    if not pids:
        return {}
    found: dict[int, str] = {}
    proc = Path("/proc")
    if proc.is_dir():
        for pid in pids:
            try:
                found[pid] = os.readlink(proc / str(pid) / "cwd")
            except OSError:
                continue
        return found
    code, out, _ = run(["lsof", "-a", "-p", ",".join(map(str, pids)), "-d", "cwd", "-Fn"], timeout=8)
    if code != 0 and not out:
        return {}
    current = None
    for line in out.splitlines():
        if line.startswith("p") and line[1:].isdigit():
            current = int(line[1:])
        elif line.startswith("n") and current is not None:
            found[current] = line[1:]
    return found


def herdr_agents() -> tuple[list[dict[str, Any]], str | None]:
    fixture = os.environ.get("WATCHER_HERDR_JSON")
    if fixture:
        try:
            return _herdr_rows(json.loads(Path(fixture).read_text(encoding="utf-8"))), None
        except (OSError, ValueError) as error:
            return [], f"herdr fixture unreadable: {error}"
    binary = os.environ.get("HERDR_BIN_PATH") or shutil.which("herdr")
    if not binary:
        return [], "herdr not installed"
    code, out, err = run([binary, "agent", "list"], timeout=8)
    if code != 0:
        return [], f"herdr agent list failed: {(err or out).strip().splitlines()[:1]}"
    try:
        return _herdr_rows(json.loads(out)), None
    except ValueError as error:
        return [], f"herdr output unreadable: {error}"


def _herdr_rows(payload: Any) -> list[dict[str, Any]]:
    result = payload.get("result", payload) if isinstance(payload, dict) else {}
    agents = result.get("agents", []) if isinstance(result, dict) else []
    rows = []
    for agent in agents if isinstance(agents, list) else []:
        if not isinstance(agent, dict):
            continue
        rows.append(
            {
                "paneId": agent.get("pane_id") or agent.get("paneId"),
                "name": agent.get("name") or agent.get("agent"),
                "kind": agent.get("agent") or agent.get("kind"),
                "status": agent.get("agent_status") or agent.get("status"),
                "cwd": agent.get("cwd"),
                "title": agent.get("title"),
            }
        )
    return rows


def runner_status() -> tuple[list[dict[str, Any]], str | None]:
    fixture = os.environ.get("WATCHER_RUNNERS_JSON")
    if fixture:
        try:
            return _runner_rows(json.loads(Path(fixture).read_text(encoding="utf-8"))), None
        except (OSError, ValueError) as error:
            return [], f"runner fixture unreadable: {error}"
    binary = shutil.which("omo-mods")
    if not binary:
        return [], "omo-mods not on PATH (set WATCHER_RUNNERS_JSON to reuse a saved status)"
    code, out, err = run([binary, "runner", "status", "--json"], timeout=60)
    if not out.strip():
        return [], f"omo-mods runner status failed: {(err or str(code)).strip()[:160]}"
    try:
        return _runner_rows(json.loads(out)), None
    except ValueError as error:
        return [], f"runner output unreadable: {error}"


def _runner_rows(payload: Any) -> list[dict[str, Any]]:
    rows = []
    for entry in payload if isinstance(payload, list) else []:
        if not isinstance(entry, dict):
            continue
        runner_entry = entry.get("runner")
        runner: dict[str, Any] = runner_entry if isinstance(runner_entry, dict) else {}
        rows.append(
            {
                "name": runner.get("name") or entry.get("name"),
                "up": entry.get("up") is True,
                "error": entry.get("error"),
                "hostname": entry.get("hostname"),
                "cores": entry.get("cores"),
                "load1": entry.get("load1"),
                "availMb": entry.get("availMb"),
                "omoVersion": entry.get("omoVersion"),
                "sessions": entry.get("sessions") if isinstance(entry.get("sessions"), list) else [],
            }
        )
    return rows


def attach_herdr_sessions(
    agents: list[dict[str, Any]],
    sessions: list[dict[str, Any]],
    seen_ids: set[str],
    now_ms: int,
) -> None:
    root = Path(os.environ.get("WATCHER_SESSIONS_ROOT") or agent_dir() / "sessions").expanduser()
    groups: dict[str, list[dict[str, Any]]] = {}
    for agent in agents:
        cwd = str(agent.get("cwd") or "")
        status = str(agent.get("status") or "").lower()
        if cwd and status in ("working", "blocked", "idle", "done"):
            groups.setdefault(os.path.realpath(cwd), []).append(agent)
    known = {item["id"]: item for item in sessions}
    for session in sessions:
        if session.get("cwd") and os.path.realpath(str(session["cwd"])) in groups:
            session["cwdHasAgents"] = True
    for cwd, group in groups.items():
        directory = root / session_key(cwd)
        if not directory.is_dir():
            continue
        candidates = sorted(directory.glob("*.jsonl"), reverse=True)[:20]
        parsed = [item for item in (parse_session(path) for path in candidates) if item]
        fresh = [item for item in parsed if item["lastAt"] >= now_ms - 86_400_000]
        for item in fresh:
            item["cwdHasAgents"] = True
            known.setdefault(item["id"], item)
        ordered = sorted(
            (item for item in known.values() if os.path.realpath(str(item.get("cwd") or "")) == cwd),
            key=lambda item: item["lastAt"],
            reverse=True,
        )
        for agent, session in zip(group, ordered):
            session.update({"live": True, "origin": "host", "attachedBy": "herdr-cwd"})
            if len(group) == 1:
                session["paneId"] = agent.get("paneId")
                session["herdrStatus"] = str(agent.get("status") or "").lower()
            else:
                session["ambiguousCwd"] = True
            if session["id"] not in seen_ids:
                seen_ids.add(session["id"])
                sessions.append(session)


def classify(
    sessions: list[dict[str, Any]],
    agents: list[dict[str, Any]],
    stalled_minutes: int,
    now_ms: int,
) -> None:
    for session in sessions:
        last_at = int(session.get("activityAt") or session.get("lastAt") or 0)
        age_minutes = max(0, (now_ms - last_at) // 60000) if last_at else 0
        session["ageMinutes"] = age_minutes
        pane = session.get("paneId")
        blocked_agent = next(
            (
                agent
                for agent in agents
                if str(agent.get("status") or "").lower() == "blocked"
                and (
                    (pane and agent.get("paneId") == pane)
                    or (
                        not pane
                        and not session.get("ambiguousCwd")
                        and agent.get("cwd")
                        and session.get("cwd")
                        and os.path.realpath(str(agent["cwd"])) == os.path.realpath(str(session["cwd"]))
                    )
                )
            ),
            None,
        )
        last_text = str(session.get("last") or "")
        looks_resolved = bool(re.search(r"\b(fixed|resolved|done|complete[d]?)\b", last_text, re.IGNORECASE))
        if session.get("runState") == "failed":
            state = "failed"
        elif blocked_agent:
            state = "blocked"
        elif session.get("noTranscript"):
            state = "unknown"
        elif not session.get("live"):
            if session.get("origin") == "runner":
                state = "saved"
            elif age_minutes > 48 * 60:
                state = "archived"
            elif session.get("cwdHasAgents") or age_minutes < stalled_minutes:
                state = "unattributed"
            else:
                state = "orphaned"
        elif ERROR_HINTS.search(last_text) and not looks_resolved:
            state = "failed"
        elif str(session.get("herdrStatus")) in ("idle", "done"):
            state = "idle"
        elif age_minutes >= stalled_minutes:
            state = "stalled"
        else:
            state = "active"
        session["state"] = state
        session["blocker"] = blocker_for(state, session, blocked_agent)


def blocker_for(state: str, session: dict[str, Any], agent: dict[str, Any] | None) -> dict[str, Any] | None:
    if state in ("active", "idle", "saved", "archived", "unknown", "unattributed"):
        return None
    if state == "blocked":
        pane = agent.get("paneId") if agent else None
        seen = " ".join(
            str(value or "")
            for value in (session.get("title"), session.get("last"), agent.get("title") if agent else "")
        )
        critical = bool(DESTRUCTIVE.search(seen))
        return {
            "kind": "approval-or-question",
            "paneId": pane,
            "evidence": f"Herdr pane {pane} is blocked" if pane else "session reports blocked",
            "reversible": not critical,
            "critical": critical,
            "action": "read the prompt; answer only within the user's existing authorization",
        }
    if state == "stalled":
        return {
            "kind": "stalled",
            "evidence": f"no assistant activity for {session.get('ageMinutes')}m",
            "reversible": True,
            "critical": False,
            "action": "read the pane, interrupt only a loop, then resume the session",
        }
    if state == "failed":
        return {
            "kind": "provider-or-session-error",
            "evidence": str(session.get("last") or "error reported")[:160],
            "reversible": True,
            "critical": False,
            "action": "retry on the same session after checking quota and auth; never switch accounts silently",
        }
    if state == "orphaned":
        return {
            "kind": "orphaned-transcript",
            "evidence": "transcript exists but no live process owns it",
            "reversible": True,
            "critical": False,
            "action": "resume with omo --session <id> if work is unfinished; otherwise leave it",
        }
    return None


def scan(stalled_minutes: int, use_herdr: bool, use_runners: bool) -> dict[str, Any]:
    now_ms = int(os.environ.get("WATCHER_NOW_MS") or time.time() * 1000)
    warnings: list[str] = []
    root = Path(os.environ.get("WATCHER_SESSIONS_ROOT") or agent_dir() / "sessions").expanduser()

    processes = process_rows(ps_lines())
    cwds = cwd_map([row["pid"] for row in processes])
    live: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for row in processes:
        cwd = cwds.get(row["pid"])
        if not cwd:
            continue
        directory = root / session_key(cwd)
        candidates = sorted(
            (path for path in directory.glob("*.jsonl")), reverse=True
        ) if directory.is_dir() else []
        parsed = [item for item in (parse_session(path) for path in candidates[:20]) if item]
        recent_live = [item for item in parsed if item["lastAt"] >= now_ms - 86_400_000]
        session = max(recent_live, key=lambda item: item["lastAt"], default=None)
        if not session:
            synthetic = f"pid-{row['pid']}"
            seen_ids.add(synthetic)
            live.append(
                {
                    "id": synthetic,
                    "cwd": cwd,
                    "title": "",
                    "workflow": None,
                    "last": "",
                    "lastAt": 0,
                    "activityAt": 0,
                    "file": "",
                    "pid": row["pid"],
                    "live": True,
                    "origin": "host",
                    "noTranscript": True,
                }
            )
            continue
        if session["id"] in seen_ids:
            continue
        seen_ids.add(session["id"])
        session.update({"pid": row["pid"], "live": True, "origin": "host"})
        live.append(session)

    recent: list[Path] = []
    if root.is_dir():
        for directory in root.iterdir():
            if directory.is_dir():
                recent.extend(path for path in directory.glob("*.jsonl"))
    recent.sort(key=lambda path: path.name, reverse=True)
    for path in recent[:40]:
        session = parse_session(path)
        if not session or session["id"] in seen_ids:
            continue
        seen_ids.add(session["id"])
        session.update({"live": False, "origin": "host"})
        live.append(session)

    agents: list[dict[str, Any]] = []
    if use_herdr:
        agents, herdr_warning = herdr_agents()
        if herdr_warning:
            warnings.append(herdr_warning)
        else:
            attach_herdr_sessions(agents, live, seen_ids, now_ms)
    else:
        warnings.append("herdr agent list skipped by flag")

    runner_rows: list[dict[str, Any]] = []
    if use_runners:
        runner_rows, runner_warning = runner_status()
        if runner_warning:
            warnings.append(runner_warning)
    else:
        warnings.append("runner inventory skipped by flag")

    sessions = list({item["id"]: item for item in live}.values())
    for runner in runner_rows:
        for entry in runner["sessions"]:
            session = {
                "id": entry.get("id"),
                "cwd": entry.get("cwd"),
                "title": entry.get("title") or "",
                "workflow": entry.get("workflow"),
                "last": entry.get("last") or "",
                "lastAt": entry.get("lastAt") or 0,
                "activityAt": entry.get("lastAt") or 0,
                "file": entry.get("file") or "",
                "pid": entry.get("pid"),
                "live": entry.get("live") is True,
                "origin": "runner",
                "runner": runner["name"],
                "runnerUp": runner["up"],
            }
            if not runner["up"]:
                session["runState"] = "failed"
            sessions.append(session)

    classify(sessions, agents, stalled_minutes, now_ms)
    blockers = [s["blocker"] for s in sessions if s.get("blocker")]
    attention = [
        {
            "paneId": agent.get("paneId"),
            "status": agent.get("status"),
            "cwd": agent.get("cwd"),
            "title": agent.get("title"),
            "criticalHint": bool(DESTRUCTIVE.search(str(agent.get("title") or ""))),
        }
        for agent in agents
        if str(agent.get("status") or "").lower() in ("blocked", "unknown")
    ]
    counts: dict[str, int] = {}
    for session in sessions:
        counts[session["state"]] = counts.get(session["state"], 0) + 1
    runners = [
        {
            "name": runner["name"],
            "up": runner["up"],
            "error": runner["error"],
            "hostname": runner["hostname"],
            "cores": runner["cores"],
            "load1": runner["load1"],
            "availMb": runner["availMb"],
            "omoVersion": runner["omoVersion"],
            "liveSessions": sum(1 for s in runner["sessions"] if s.get("live")),
        }
        for runner in runner_rows
    ]
    return {
        "generatedAt": now_ms,
        "host": os.uname().nodename,
        "sessionsRoot": str(root),
        "stalledMinutes": stalled_minutes,
        "herdrAgents": agents,
        "herdrAttention": attention,
        "sessions": sorted(sessions, key=lambda s: (s.get("state") != "active", s.get("origin"), s.get("cwd") or "")),
        "runners": runners,
        "summary": {
            "total": len(sessions),
            "byState": counts,
            "blockers": len(blockers),
            "runnersUp": sum(1 for runner in runners if runner["up"]),
            "runnersDown": sum(1 for runner in runners if not runner["up"]),
            "criticalApprovals": len(
                {agent["paneId"] for agent in attention if agent.get("criticalHint") and agent.get("paneId")}
            )
            + sum(1 for blocker in blockers if blocker.get("critical") and not blocker.get("paneId")),
            "blockedPanes": sum(1 for agent in attention if agent.get("status") == "blocked"),
            "unknownPanes": sum(1 for agent in attention if agent.get("status") == "unknown"),
        },
        "warnings": warnings,
    }


def human(report: dict[str, Any]) -> str:
    lines = [
        f"watcher scan {report['host']}  sessions={report['summary']['total']}  "
        f"runners={report['summary']['runnersUp']} up / {report['summary']['runnersDown']} down  "
        f"blockers={report['summary']['blockers']} (critical {report['summary']['criticalApprovals']})"
    ]
    for session in report["sessions"]:
        where = session.get("runner") or "host"
        repo = (session.get("cwd") or "?").rstrip("/").split("/")[-1]
        title = (session.get("title") or "").replace("\n", " ")[:52]
        lines.append(
            f"  {session['state']:<9} {where:<14} {repo:<24} {str(session.get('ageMinutes', 0)):>4}m  "
            f"{(session.get('id') or '')[:12]}  {title}"
        )
        blocker = session.get("blocker")
        if blocker:
            lines.append(
                f"            -> {blocker['kind']}: {blocker['evidence'][:90]}"
                f"{' [CRITICAL]' if blocker.get('critical') else ''}"
            )
    for agent in report["herdrAttention"]:
        lines.append(
            f"  attention {agent['paneId'] or '?'} {agent['status']} "
            f"{str(agent.get('cwd') or '').rstrip('/').split('/')[-1]}: {str(agent.get('title') or '')[:70]}"
            f"{' [CHECK: destructive wording]' if agent.get('criticalHint') else ''}"
        )
    for runner in report["runners"]:
        state = "up" if runner["up"] else f"DOWN ({runner.get('error') or 'unreachable'})"
        lines.append(
            f"  runner {runner['name']:<16} {state:<28} live={runner['liveSessions']} "
            f"load={runner.get('load1')}/{runner.get('cores')} omo={runner.get('omoVersion')}"
        )
    for warning in report["warnings"]:
        lines.append(f"  warning: {warning}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Enumerate and classify OmO sessions")
    parser.add_argument("--json", action="store_true", help="one JSON document")
    parser.add_argument(
        "--stalled-minutes", type=int, default=int(os.environ.get("WATCHER_STALLED_MINUTES", "20"))
    )
    parser.add_argument("--no-herdr", action="store_true")
    parser.add_argument("--no-runners", action="store_true")
    args = parser.parse_args(argv)
    if args.stalled_minutes < 1:
        parser.error("--stalled-minutes must be >= 1")
    report = scan(args.stalled_minutes, not args.no_herdr, not args.no_runners)
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(human(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
