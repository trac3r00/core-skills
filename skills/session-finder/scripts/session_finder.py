#!/usr/bin/env python3
"""Find and safely administer live coding-agent processes."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import signal
import subprocess
import sys
import time
from typing import TypedDict

Pattern = re.Pattern[str]
Process = dict[str, int | str]


class Summary(TypedDict):
    count: int
    clients: dict[str, int]
    sessions: list[Process]

AGENT_PATTERNS: tuple[tuple[str, Pattern], ...] = (
    ("claude-code", re.compile(r"(?:^|[\s/])claude(?:[\s/]|$)|claude-code", re.I)),
    ("codex", re.compile(r"(?:^|[\s/])codex(?:[\s/]|$)|codex-cli", re.I)),
    (
        "omo",
        re.compile(
            r"(?:^|[\s/])(?:omo|senpi)(?:\.js)?(?:[\s/]|$)|"
            r"omo-ai|@code-yeongyu/(?:senpi|omo)|/omo\.js\b",
            re.I,
        ),
    ),
    ("gjc", re.compile(r"(?:^|[\s/])(?:gjc|gajae-code)(?:[\s/]|$)", re.I)),
    ("hermes", re.compile(r"(?:^|[\s/])hermes(?:[\s/]|$)", re.I)),
    ("opencode", re.compile(r"(?:^|[\s/])opencode(?:[\s/]|$)", re.I)),
    ("aider", re.compile(r"(?:^|[\s/])aider(?:[\s/]|$)", re.I)),
    ("cursor", re.compile(r"(?:^|[\s/])cursor(?:[\s/]|$)", re.I)),
    ("gemini-cli", re.compile(r"(?:^|[\s/])gemini(?:[\s/]|$)|gemini-cli", re.I)),
)

EXCLUDE = re.compile(
    r"(?:session[_-]finder|(?:agent|core)-skills|pytest|(?:^|[\s/])grep(?:[\s/]|$))",
    re.I,
)
NON_SESSION_HELPER = re.compile(r"(?:crashpad_handler|lsp-daemon)", re.I)
SHELL_WRAPPER = re.compile(r"^(?:/bin/)?(?:ba|z|fi|da)?sh\s+-c\s+", re.I)
OMO_HOST = re.compile(r"(?:--multi-session|--mode\s+(?:rpc|server)|\bomo\s+host\b)", re.I)
OMO_SUPERVISOR = re.compile(r"--internal-rpc-host-supervisor", re.I)


def _ps_command() -> list[str]:
    """Return the portable process-table command for this operating system."""
    fields = "pid=,ppid=,etime=,command="
    return ["ps", "-axo" if platform.system() == "Darwin" else "-eo", fields]


def _client_role(client: str, command: str) -> str:
    """Classify an OmO host separately from an interactive client."""
    if client == "omo" and OMO_SUPERVISOR.search(command):
        return "supervisor"
    return "host" if client == "omo" and OMO_HOST.search(command) else "client"


def _matched_client(command: str, extra: Pattern | None) -> str | None:
    """Return the first known provider matching a command line."""
    if EXCLUDE.search(command) or NON_SESSION_HELPER.search(command) or SHELL_WRAPPER.search(command):
        return None
    for client, pattern in AGENT_PATTERNS:
        if pattern.search(command):
            return client
    if extra is not None and extra.search(command):
        return "custom"
    return None


def detect(match_extra: str = "") -> list[Process]:
    """Scan the local process table and return recognized agent processes."""
    extra = re.compile(match_extra, re.I) if match_extra else None
    result = subprocess.run(_ps_command(), capture_output=True, text=True, check=False)
    sessions: list[Process] = []
    for line in (result.stdout or "").splitlines():
        parts = line.split(None, 3)
        if len(parts) < 4:
            continue
        client = _matched_client(parts[3], extra)
        if client is None:
            continue
        sessions.append({
            "pid": int(parts[0]),
            "ppid": int(parts[1]),
            "client": client,
            "role": _client_role(client, parts[3]),
            "uptime": parts[2],
            "command": parts[3][:240],
        })
    return sessions


def summarize(sessions: list[Process]) -> Summary:
    """Group recognized processes by provider."""
    clients: dict[str, int] = {}
    for session in sessions:
        client = str(session["client"])
        clients[client] = clients.get(client, 0) + 1
    return {"count": len(sessions), "clients": clients, "sessions": sessions}


def is_agent_pid(pid: int, match_extra: str = "") -> bool:
    """Check a PID against a fresh process scan before a signal is sent."""
    return any(session["pid"] == pid for session in detect(match_extra))


def _report(sessions: list[Process], as_json: bool) -> int:
    report = summarize(sessions)
    if as_json:
        print(json.dumps(report, indent=2))
    elif not sessions:
        print("no AI agent sessions running")
    else:
        for session in sessions:
            print(
                f"{session['client']:<12} {session['role']:<6} "
                f"pid={session['pid']:<7} up={session['uptime']:<10} "
                f"{str(session['command'])[:80]}",
            )
        clients = ", ".join(f"{key}={value}" for key, value in sorted(report["clients"].items()))
        print(f"\n{report['count']} session(s): {clients}")
    return 0 if sessions else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "session-finder").splitlines()[0])
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--match", default="", help="extra regular expression to match")
    parser.add_argument("--kill", type=int, metavar="PID")
    parser.add_argument("--watch", type=int, default=0, metavar="SECONDS")
    args = parser.parse_args(argv)
    if args.watch < 0:
        parser.error("--watch must be non-negative")
    if args.kill is not None and args.kill <= 0:
        parser.error("--kill must be a positive PID")
    try:
        if args.match:
            re.compile(args.match, re.I)
    except re.error as error:
        parser.error(f"--match is not a valid regular expression: {error}")

    if args.kill is not None:
        if not is_agent_pid(args.kill, args.match):
            print(
                f"refused: PID {args.kill} is not a detected agent process "
                "(safe-kill only terminates recognized AI agents)",
                file=sys.stderr,
            )
            return 2
        try:
            os.kill(args.kill, signal.SIGTERM)
        except ProcessLookupError:
            print(f"refused: PID {args.kill} exited before SIGTERM", file=sys.stderr)
            return 2
        except PermissionError:
            print(f"refused: permission denied for PID {args.kill}", file=sys.stderr)
            return 2
        print(f"SIGTERM sent to {args.kill}")
        return 0

    if args.watch:
        try:
            while True:
                _report(detect(args.match), args.json)
                print(f"--- next scan in {args.watch}s (Ctrl-C to stop) ---")
                time.sleep(args.watch)
        except KeyboardInterrupt:
            return 0
    return _report(detect(args.match), args.json)


if __name__ == "__main__":
    raise SystemExit(main())
