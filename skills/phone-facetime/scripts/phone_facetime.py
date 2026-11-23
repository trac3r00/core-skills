#!/usr/bin/env python3
"""Manage macOS Phone and FaceTime calls with URL schemes and Accessibility.

Exit codes: 0 success, 1 app-level failure, 2 usage/permission or a call awaiting --yes.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import platform
import re
import sqlite3
import subprocess
import sys
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType
from typing import Any
from urllib.parse import quote

sys.dont_write_bytecode = True

BUNDLES = {"phone": "com.apple.mobilephone", "facetime": "com.apple.FaceTime"}
HISTORY = Path.home() / "Library/Application Support/CallHistoryDB/CallHistory.storedata"
NUMBER = re.compile(r"\+?[\d\s().-]+", re.ASCII)
DURATION = re.compile(r"\b\d{1,2}:\d{2}(?::\d{2})?\b")
END = {"end", "end call", "end facetime", "hang up"}
RING = {"accept", "answer", "decline"}


class CallError(Exception):
    def __init__(self, message: str, code: int = 1) -> None:
        super().__init__(message)
        self.code = code


def macax() -> ModuleType:
    spec = importlib.util.spec_from_file_location("macax", Path(__file__).resolve().parent / "macax.py")
    if spec is None or spec.loader is None:
        raise CallError("macax.py is missing next to phone_facetime.py", 2)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def contact_number(name: str) -> str:
    escaped = name.replace("\\", "\\\\").replace('"', '\\"')
    script = f'''tell application "Contacts"
set matches to every person whose name is "{escaped}"
if (count of matches) is not 1 then return "MATCHES:" & (count of matches)
set phoneValues to (value of every phone of (item 1 of matches))
if (count of phoneValues) is not 1 then return "NUMBERS:" & (count of phoneValues)
return item 1 of phoneValues
end tell'''
    result = subprocess.run(["/usr/bin/osascript", "-e", script], capture_output=True, text=True, check=False)
    if result.returncode:
        raise CallError(f"Contacts lookup failed: {result.stderr.strip()}")
    value = result.stdout.strip()
    if value.startswith(("MATCHES:", "NUMBERS:")):
        raise CallError(f"Contacts lookup for {name!r} is not unique: {value}")
    return value


def call_url(target: str, scheme: str) -> str:
    if not NUMBER.fullmatch(target) or not any(char.isdigit() for char in target):
        target = contact_number(target)
    if not NUMBER.fullmatch(target) or not any(char.isdigit() for char in target):
        raise CallError("Contact has no usable phone number")
    number = re.sub(r"[\s().-]", "", target)
    return f"{scheme}:{quote(number, safe='+')}"


def app_windows(ax: ModuleType, bundle: str) -> list[Any]:
    pid = ax.app_pid(bundle)
    if pid is None:
        return []
    return list(ax.application(pid).attr("AXWindows") or [])


def call_controls(window: Any) -> tuple[dict[str, Any], list[str]]:
    buttons: dict[str, Any] = {}
    texts: list[str] = []
    for element in window.walk(500):
        if element.role == "AXButton":
            label = (element.description or element.title).strip().casefold()
            if label in END | RING | {"mute", "unmute"}:
                buttons[label] = element
        elif element.role in ("AXStaticText", "AXHeading"):
            value = element.attr("AXValue") or element.title or element.description
            if isinstance(value, str) and value.strip():
                texts.append(value.strip())
    return buttons, texts


def active_call(ax: ModuleType) -> tuple[str, Any, dict[str, Any], list[str]] | None:
    for name, bundle in BUNDLES.items():
        for window in app_windows(ax, bundle):
            buttons, texts = call_controls(window)
            if END.intersection(buttons) or RING.intersection(buttons):
                return name, window, buttons, texts
    return None


def status(ax: ModuleType) -> dict[str, Any]:
    current = active_call(ax)
    if current is None:
        return {"state": "idle", "source": "AX", "apps_running": [name for name, bundle in BUNDLES.items() if ax.app_pid(bundle) is not None]}
    name, window, buttons, texts = current
    state = "in_call" if END.intersection(buttons) else "ringing"
    duration = next((match.group() for text in texts if (match := DURATION.search(text))), None)
    participants = [text for text in texts if not DURATION.fullmatch(text) and text.casefold() not in
                    {"phone", "facetime", "audio", "video", "calling", "connecting", "ringing", "mute", "unmute"}]
    return {"state": state, "app": name, "with": participants[0] if participants else None,
            "duration": duration, "source": "AX", "window": window.title}


def press_control(ax: ModuleType, action: str) -> dict[str, str]:
    current = active_call(ax)
    if current is None:
        article = "an" if action == "unmute" else "a"
        raise CallError(f"no call window with {article} {action} control")
    name, _, buttons, _ = current
    labels = END if action == "hangup" else {action}
    button = next((buttons[label] for label in labels if label in buttons), None)
    if button is None:
        raise CallError(f"{action} control is not exposed in the {name} call window")
    if not button.perform("AXPress"):
        raise CallError(f"{action} control could not be pressed in {name}")
    return {"action": action, "app": name}


def ax_recents(ax: ModuleType, limit: int) -> dict[str, Any] | None:
    for name, bundle in BUNDLES.items():
        for window in app_windows(ax, bundle):
            rows: list[str] = []
            for element in window.walk(800):
                row = element.identifier == "PhoneAppRecentsCell" if name == "phone" else (
                    element.identifier.startswith("FaceTime.RecentsList.Section") and ".Row" in element.identifier
                )
                if row:
                    labels = [child.description or child.title for child in element.walk(12)
                              if child.role == "AXButton" and (child.description or child.title)]
                    rows.extend(label for label in labels if "Suggested" not in label)
                if len(rows) >= limit:
                    break
            if rows:
                return {"source": f"{name} AX recents (visible rows)", "count": len(rows[:limit]), "recents": rows[:limit]}
    return None


def db_recents(limit: int) -> dict[str, Any]:
    if not HISTORY.exists():
        raise CallError("CallHistory store is absent and no AX recents are visible")
    try:
        with closing(sqlite3.connect(f"{HISTORY.as_uri()}?mode=ro", uri=True)) as db:
            rows = db.execute(
                "SELECT ZDATE, ZDURATION, ZNAME, ZADDRESS, ZORIGINATED, ZANSWERED "
                "FROM ZCALLRECORD ORDER BY ZDATE DESC LIMIT ?", (limit,)
            ).fetchall()
    except sqlite3.Error as error:
        raise CallError(f"CallHistory read-only access failed ({error}); grant Full Disk Access or open Phone for AX recents") from error
    epoch = datetime(2001, 1, 1, tzinfo=timezone.utc)
    recents = [
        {"date": (epoch + timedelta(seconds=date)).isoformat() if date is not None else None,
         "name": name, "address": address, "direction": "outgoing" if originated else "incoming",
         "answered": bool(answered), "duration_seconds": duration}
        for date, duration, name, address, originated, answered in rows
    ]
    return {"source": str(HISTORY) + " (sqlite read-only)", "count": len(recents), "recents": recents}


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="phone_facetime.py", description=__doc__)
    root.add_argument("--json", action="store_true", help="machine-readable output")
    commands = root.add_subparsers(dest="command", required=True)
    caller = commands.add_parser("call", help="preview or place a call (requires --yes)")
    caller.add_argument("target", metavar="NUMBER_OR_CONTACT")
    modes = caller.add_mutually_exclusive_group()
    modes.add_argument("--facetime", action="store_true", help="FaceTime video")
    modes.add_argument("--audio", action="store_true", help="FaceTime audio")
    caller.add_argument("--yes", action="store_true", help="open the call URL")
    caller.add_argument("--dry-run", action="store_true", help="print URL without opening, even with --yes")
    commands.add_parser("status", help="read visible call state through AX")
    commands.add_parser("hangup", help="AXPress the exposed End button")
    commands.add_parser("mute", help="AXPress an exposed Mute button")
    commands.add_parser("unmute", help="AXPress an exposed Unmute button")
    recent = commands.add_parser("recents", help="visible AX recents or read-only CallHistory")
    recent.add_argument("--limit", type=int, default=20)
    opener = commands.add_parser("open", help="open the Phone or FaceTime app")
    opener.add_argument("app", choices=tuple(BUNDLES))
    for command in commands.choices.values():
        command.add_argument("--json", action="store_true", default=argparse.SUPPRESS)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if platform.system() != "Darwin":
        print(json.dumps({"error": "macOS required"}) if args.json else "error: macOS required")
        return 2
    try:
        if args.command == "call":
            scheme = "facetime" if args.facetime else "facetime-audio" if args.audio else "tel"
            url = call_url(args.target, scheme)
            if not args.yes and not args.dry_run:
                print(json.dumps({"url": url, "confirmation_required": True}) if args.json else url)
                return 2
            if args.dry_run:
                result = {"url": url, "dry_run": True}
            else:
                opened = subprocess.run(["/usr/bin/open", url], capture_output=True, text=True, check=False)
                if opened.returncode:
                    raise CallError(f"could not open {url}: {opened.stderr.strip()}")
                result = {"url": url, "opened": True}
        elif args.command == "open":
            opened = subprocess.run(["/usr/bin/open", "-b", BUNDLES[args.app]], capture_output=True, text=True, check=False)
            if opened.returncode:
                raise CallError(f"could not open {args.app}: {opened.stderr.strip()}")
            result = {"opened": args.app, "bundle": BUNDLES[args.app]}
        else:
            ax = macax()
            if args.command == "recents":
                if args.limit < 1:
                    raise CallError("--limit must be positive", 2)
                result = ax_recents(ax, args.limit) if ax.trusted() else None
                if result is None:
                    result = db_recents(args.limit)
            else:
                if not ax.trusted():
                    raise CallError("Accessibility access is off; enable the terminal or OmO host under Privacy & Security > Accessibility", 2)
                result = status(ax) if args.command == "status" else press_control(ax, args.command)
    except CallError as error:
        print(json.dumps({"error": str(error)}) if args.json else f"error: {error}")
        return error.code
    print(json.dumps(result, ensure_ascii=False) if args.json else "\n".join(f"{key}: {value}" for key, value in result.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
