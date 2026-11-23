#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# How to run: python3 scripts/apple_tv.py --json status
"""Control the macOS TV app through its AppleScript dictionary.

Exit codes: 0 success, 1 app-level failure, 2 usage, permission or non-macOS.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = Path(__file__).resolve().parent.name

from ._tv_app import app_command
from ._tv_common import TVError


class TVArgs(argparse.Namespace):
    """Typed views of the properties populated by the CLI parser."""

    action: str = ""
    query: str = ""
    name: str = ""
    level: int = 0


def volume_level(value: str) -> int:
    """Parse a TV player volume between zero and one hundred."""
    try:
        level = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("volume must be 0..100") from error
    if not 0 <= level <= 100:
        raise argparse.ArgumentTypeError("volume must be 0..100")
    return level


def parser() -> argparse.ArgumentParser:
    """Build a TV app CLI with JSON available before or after commands."""
    root = argparse.ArgumentParser(description=__doc__)
    _ = root.add_argument("--json", action="store_true")
    actions = root.add_subparsers(dest="action", required=True)
    for name in ("status", "play", "pause", "toggle", "next", "previous",
                 "search", "play-item", "volume"):
        command = actions.add_parser(name)
        _ = command.add_argument("--json", action="store_true",
                                 default=argparse.SUPPRESS)
        if name == "search":
            _ = command.add_argument("query")
        if name == "play-item":
            _ = command.add_argument("name")
        if name == "volume":
            _ = command.add_argument("level", type=volume_level)
    return root


def main(argv: list[str] | None = None) -> int:
    """Print command results or sanitized errors with the documented exit codes."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    json_output = "--json" in arguments
    options = parser().parse_args(
        [arg for arg in arguments if arg != "--json"], namespace=TVArgs(),
    )
    try:
        if sys.platform != "darwin" or not Path("/usr/bin/osascript").exists():
            raise TVError("macOS and /usr/bin/osascript are required", 2)
        result = app_command(options)
    except TVError as error:
        payload = {"error": str(error)}
        print(json.dumps(payload, ensure_ascii=False) if json_output else f"error: {error}")
        return error.code
    print(json.dumps(result, ensure_ascii=False) if json_output else
          "\n".join(f"{key}: {value}" for key, value in result.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
