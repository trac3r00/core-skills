#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly (no venv, no pip install needed):
#      uv run spotify.py --json status
# 3. Or make executable and run:
#      chmod +x spotify.py && ./spotify.py --json status
# ──────────────────

"""Read and control Spotify.app through AppleScript.

Exit codes: 0 success, 1 Spotify/app error, 2 usage, permission, or non-macOS.
"""

from __future__ import annotations

import argparse
import base64
import json
import platform
import subprocess
import sys
from dataclasses import dataclass
from math import isfinite
from typing import Final, TypeAlias
from urllib.parse import quote

sys.dont_write_bytecode = True

TAB: Final = "character id 9"
JsonValue: TypeAlias = str | int | float | bool | None | list[str] | list[dict[str, str | int]] | dict[str, "JsonValue"]
# Reading status must not launch Spotify, and a player with no loaded track has no current-track fields.
STATUS_BODY: Final = f"""if application "Spotify" is not running then
set answerText to my b64("not running")
else
tell application "Spotify"
set stateValue to player state as text
set trackName to ""
set artistName to ""
set albumName to ""
set trackDuration to ""
set trackPosition to ""
set trackUrl to ""
try
-- Read the URL first and again last, so metadata from two different tracks is never combined.
set trackUrl to spotify url of current track as text
-- Re-sample the state inside the guard so it belongs to the same track as the metadata.
set stateValue to player state as text
set trackName to name of current track as text
set artistName to artist of current track as text
set albumName to album of current track as text
set trackDuration to duration of current track as text
set trackPosition to player position as text
-- Spotify IDs are case-sensitive, and AppleScript text comparison ignores case by default.
considering case
if (spotify url of current track as text) is not trackUrl then error "track changed while reading" number 9901
end considering
on error errorMessage number errorNumber
-- Only a missing current track (-1700 coercion, -1728 no such object) means "no track"; re-raise anything else.
if errorNumber is not in {{-1700, -1728}} then error errorMessage number errorNumber
-- Drop anything read before the track vanished so no stale metadata is reported.
set trackName to ""
set artistName to ""
set albumName to ""
set trackDuration to ""
set trackPosition to ""
set trackUrl to ""
end try
-- With no track, re-sample the state after the failure so it matches the empty metadata.
if trackUrl is "" then
set stateValue to player state as text
-- Confirm the track is still absent after that sample; a track that appeared meanwhile is churn (retried once).
try
set trackUrl to spotify url of current track as text
error "track changed while reading" number 9901
on error errorMessage number errorNumber
if errorNumber is not in {{-1700, -1728}} then error errorMessage number errorNumber
set trackUrl to ""
end try
end if
set volumeValue to sound volume as text
set shuffleValue to shuffling as text
set repeatValue to repeating as text
set answerText to (my b64(stateValue) & {TAB} & my b64(trackName) & {TAB} & my b64(artistName) & {TAB} & my b64(albumName) & {TAB} & trackDuration & {TAB} & trackPosition & {TAB} & my b64(trackUrl) & {TAB} & volumeValue & {TAB} & shuffleValue & {TAB} & repeatValue)
end tell
end if"""
NOT_RUNNING: Final = "not running"


@dataclass(frozen=True, slots=True)
class SkillError(Exception):
    """An expected CLI, permission, or Spotify application failure."""

    message: str
    code: int = 1

    def __str__(self) -> str:
        return self.message


def run_script(body: str, *args: str) -> list[str]:
    """Run an AppleScript body and return its newline-delimited payload."""
    script = f"""use framework "Foundation"
use scripting additions
on b64(value)
set dataValue to ((current application's NSString's stringWithString:(value as text))'s dataUsingEncoding:(current application's NSUTF8StringEncoding))
return (dataValue's base64EncodedStringWithOptions:0) as text
end b64
on run argv
try
{body}
return "OK" & linefeed & answerText
on error errorMessage number errorNumber
return "ERROR" & linefeed & my b64(errorMessage & " (" & errorNumber & ")")
end try
end run"""
    if platform.system() != "Darwin" or not sys.executable:
        raise SkillError("Spotify requires macOS", 2)
    try:
        result = subprocess.run(
            ["/usr/bin/osascript", "-e", script, "--", *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as error:
        raise SkillError("Spotify Automation did not respond", 2 if isinstance(error, FileNotFoundError) else 1) from error
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or "osascript failed"
        code = 2 if any(token in detail.lower() for token in ("-1743", "not authorized", "not permitted")) else 1
        raise SkillError(detail, code)
    lines = result.stdout.rstrip("\n").split("\n")
    if not lines or lines[0] != "OK":
        if lines and lines[0] == "ERROR" and len(lines) > 1:
            detail = base64.b64decode(lines[1]).decode("utf-8")
        else:
            detail = result.stdout.strip() or "Spotify returned no response"
        code = 2 if any(token in detail.lower() for token in ("-1743", "not authorized", "not permitted")) else 1
        raise SkillError(detail, code)
    return lines[1:] if len(lines) > 1 and lines[1] else []


def status() -> dict[str, JsonValue]:
    """Read Spotify's current player state."""
    try:
        lines = run_script(STATUS_BODY)
    except SkillError as error:
        # A track change mid-read is retried once; a second change is reported, never merged.
        if "(9901)" not in str(error):
            raise
        lines = run_script(STATUS_BODY)
    if len(lines) != 1:
        raise SkillError("Spotify returned an invalid status payload")
    fields = lines[0].split("\t")
    if len(fields) == 1 and base64.b64decode(fields[0]).decode() == NOT_RUNNING:
        empty: dict[str, JsonValue] = dict.fromkeys(
            ("track_name", "artist", "album", "duration_ms", "position_seconds", "spotify_url", "volume", "shuffle", "repeat"),
        )
        return {"player_state": NOT_RUNNING, **empty}
    if len(fields) != 10:
        raise SkillError("Spotify returned an invalid status field count")

    def text(value: str) -> str | None:
        return base64.b64decode(value).decode() or None

    try:
        return {
            "player_state": base64.b64decode(fields[0]).decode(),
            "track_name": text(fields[1]),
            "artist": text(fields[2]),
            "album": text(fields[3]),
            # AppleScript "as text" uses the system decimal separator (e.g. "153,5").
            "duration_ms": int(float(fields[4].replace(",", "."))) if fields[4] else None,
            "position_seconds": float(fields[5].replace(",", ".")) if fields[5] else None,
            "spotify_url": text(fields[6]),
            "volume": int(fields[7]),
            "shuffle": fields[8].lower() == "true",
            "repeat": fields[9].lower() == "true",
        }
    except (ValueError, UnicodeDecodeError) as error:
        raise SkillError("Spotify returned malformed status values") from error


def mutation(action: str, body: str, *args: str, launch: bool = False) -> dict[str, JsonValue]:
    """Run one Spotify mutation and report its resulting status.

    Only playback requests (launch=True) may start Spotify; anything else refuses when it is closed,
    because a launch can resume playback on its own.
    """
    if not launch:
        body = 'if application "Spotify" is not running then error "Spotify is not running" number 9902\n' + body
    run_script(body + '\nset answerText to "done"', *args)
    return {"action": action, "status": status()}


def parser() -> argparse.ArgumentParser:
    """Build the command-line parser."""
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("status")
    play = commands.add_parser("play")
    play.add_argument("uri", nargs="?")
    for name in ("pause", "toggle", "next", "previous"):
        commands.add_parser(name)
    seek = commands.add_parser("seek")
    seek.add_argument("seconds", type=float)
    volume = commands.add_parser("volume")
    volume.add_argument("value", type=int, nargs="?")
    for name in ("shuffle", "repeat"):
        switch = commands.add_parser(name)
        switch.add_argument("value", choices=("on", "off"))
    search = commands.add_parser("open-search")
    search.add_argument("query")
    opener = commands.add_parser("open")
    opener.add_argument("uri")
    return root


def execute(args: argparse.Namespace) -> dict[str, JsonValue]:
    """Dispatch one parsed command."""
    if args.command == "status":
        return status()
    if args.command == "play":
        body = 'tell application "Spotify" to play' if args.uri is None else 'tell application "Spotify" to play track (item 1 of argv)'
        return mutation("play", body, *(() if args.uri is None else (args.uri,)), launch=True)
    if args.command == "pause":
        return mutation("pause", 'tell application "Spotify" to pause')
    if args.command == "toggle":
        return mutation("toggle", 'tell application "Spotify" to playpause', launch=True)
    if args.command in ("next", "previous"):
        command = "next track" if args.command == "next" else "previous track"
        return mutation(args.command, f'tell application "Spotify" to {command}')
    if args.command == "seek":
        if not isfinite(args.seconds) or args.seconds < 0:
            raise SkillError("seek seconds must be a finite nonnegative number", 2)
        return mutation("seek", 'tell application "Spotify" to set player position to (item 1 of argv)', str(args.seconds))
    if args.command == "volume":
        if args.value is None:
            return {"volume": status()["volume"]}
        if not 0 <= args.value <= 100:
            raise SkillError("volume must be between 0 and 100", 2)
        # Spotify stores some values one step low (set 50 reads 49), and a read inside the same script can be
        # stale, so check a separate status read and compensate once by +1 when it is short.
        setter = 'tell application "Spotify" to set sound volume to ((item 1 of argv) as integer)'
        result = mutation("volume", setter, str(args.value))
        actual = result["status"]["volume"] if isinstance(result["status"], dict) else None
        if isinstance(actual, int) and actual < args.value < 100:
            result = mutation("volume", setter, str(args.value + 1))
            actual = result["status"]["volume"] if isinstance(result["status"], dict) else None
        if actual != args.value:
            raise SkillError(f"Spotify volume reads {actual} after requesting {args.value}; that value is not reachable exactly")
        return {**result, "requested": args.value, "exact": True}
    if args.command in ("shuffle", "repeat"):
        property_name = "shuffling" if args.command == "shuffle" else "repeating"
        return mutation(args.command, f'tell application "Spotify" to set {property_name} to ((item 1 of argv) is "on")', args.value)
    if args.command == "open-search":
        uri = "spotify:search:" + quote(args.query, safe="")
        return mutation("open-search", 'open location (item 1 of argv)', uri, launch=True)
    return mutation("open", 'open location (item 1 of argv)', args.uri, launch=True)


def emit(result: dict[str, JsonValue], as_json: bool) -> None:
    """Print a successful result."""
    if as_json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        for key, value in result.items():
            print(f"{key}: {value}")


def main(argv: list[str] | None = None) -> int:
    """Run the Spotify CLI."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    # --json is a global flag only before "--"; after it, every token is positional data.
    end = arguments.index("--") if "--" in arguments else len(arguments)
    as_json = "--json" in arguments[:end]
    arguments = [argument for argument in arguments[:end] if argument != "--json"] + arguments[end:]
    try:
        result = execute(parser().parse_args(arguments))
    except SkillError as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        return error.code
    emit(result, as_json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
