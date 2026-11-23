#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# How to run: python3 skills/moffice/scripts/moffice.py apps --json
"""Drive installed Microsoft Office apps using their AppleScript dictionaries."""

from __future__ import annotations

import argparse
import json
import plistlib
import sys
from pathlib import Path
from typing import TypedDict

if not __package__:
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = Path(__file__).resolve().parent.name

from ._excel import excel
from ._office import OfficeError, staged
from ._powerpoint import powerpoint
from ._word import word


class AppInfo(TypedDict):
    installed: bool
    version: str | None


def apps() -> dict[str, AppInfo]:
    result: dict[str, AppInfo] = {}
    for name in ("Word", "Excel", "PowerPoint", "Outlook", "OneNote", "Teams", "OneDrive"):
        bundle = Path(f"/Applications/Microsoft {name}.app/Contents/Info.plist")
        version: str | None = None
        if bundle.is_file():
            with bundle.open("rb") as stream:
                plist = plistlib.load(stream)
            version = plist.get("CFBundleShortVersionString")
        result[name] = {"installed": bundle.is_file(), "version": version}
    return result


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="app", required=True)
    commands.add_parser("apps")
    excel_cmd = commands.add_parser("excel")
    excel_actions = excel_cmd.add_subparsers(dest="action", required=True)
    for action in ("sheets", "read", "new", "export-pdf", "write"):
        cmd = excel_actions.add_parser(action)
        cmd.add_argument("file")
        if action == "read":
            cmd.add_argument("--sheet")
            cmd.add_argument("--range")
        if action == "write":
            cmd.add_argument("--sheet", required=True)
            cmd.add_argument("--range", required=True)
            cmd.add_argument("--values", required=True)
        if action == "export-pdf":
            cmd.add_argument("out")
    word_cmd = commands.add_parser("word")
    word_actions = word_cmd.add_subparsers(dest="action", required=True)
    for action in ("read", "create", "append", "replace", "export-pdf"):
        cmd = word_actions.add_parser(action)
        cmd.add_argument("file")
        if action in ("create", "append"):
            cmd.add_argument("--text", required=True)
        if action == "create":
            cmd.add_argument("--title")
        if action == "replace":
            cmd.add_argument("--find", required=True)
            cmd.add_argument("--with", dest="replacement", required=True)
            cmd.add_argument("--all", action="store_true")
        if action == "export-pdf":
            cmd.add_argument("out")
    ppt_cmd = commands.add_parser("powerpoint")
    ppt_actions = ppt_cmd.add_subparsers(dest="action", required=True)
    for action in ("read", "create", "add-slide", "export-pdf"):
        cmd = ppt_actions.add_parser(action)
        cmd.add_argument("file")
        if action == "create":
            cmd.add_argument("--slides", required=True)
        if action == "add-slide":
            cmd.add_argument("--title", required=True)
            cmd.add_argument("--body", required=True)
        if action == "export-pdf":
            cmd.add_argument("out")
    return root


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    json_output = "--json" in arguments
    arguments = [arg for arg in arguments if arg != "--json"]
    options = parser().parse_args(arguments)
    if sys.platform != "darwin" or not Path("/usr/bin/osascript").exists():
        print("error: macOS and /usr/bin/osascript are required", file=sys.stderr)
        return 2
    if options.app != "apps" and not apps()[options.app.capitalize() if options.app != "powerpoint" else "PowerPoint"]["installed"]:
        print(f"error: Microsoft {options.app} is not installed", file=sys.stderr)
        return 2
    try:
        with staged(options) as mapping:
            if options.app == "apps":
                result = {"apps": apps()}
            elif options.app == "excel":
                result = excel(options)
            elif options.app == "word":
                result = word(options)
            else:
                result = powerpoint(options)
        if isinstance(result.get("file"), str):
            result["file"] = mapping.get(result["file"], result["file"])
    except OfficeError as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        return 1
    if json_output:
        print(json.dumps(result, ensure_ascii=False))
    else:
        for key, value in result.items():
            print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
