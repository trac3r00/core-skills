#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly (no venv, no pip install needed):
#      uv run finder.py --json selection
# 3. Or make executable and run:
#      chmod +x finder.py && ./finder.py --json selection
# ──────────────────

"""Read and control Finder.app through AppleScript and xattr.

Exit codes: 0 success, 1 Finder/filesystem error, 2 usage, permission, or
non-macOS.
"""

from __future__ import annotations

import argparse
import base64
import json
import platform
import plistlib
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final, TypeAlias

sys.dont_write_bytecode = True

ATTR: Final = "com.apple.metadata:_kMDItemUserTags"
JsonValue: TypeAlias = str | int | float | bool | None | list[str] | list[dict[str, str | int]] | dict[str, "JsonValue"]


@dataclass(frozen=True, slots=True)
class SkillError(Exception):
    """An expected CLI, permission, Finder, or filesystem failure."""

    message: str
    code: int = 1

    def __str__(self) -> str:
        return self.message


def run_script(body: str, *args: str) -> list[str]:
    """Run a Finder AppleScript body and return its newline-delimited payload."""
    script = f"""use framework "Foundation"
use scripting additions
on b64(value)
set dataValue to ((current application's NSString's stringWithString:(value as text))'s dataUsingEncoding:(current application's NSUTF8StringEncoding))
return (dataValue's base64EncodedStringWithOptions:0) as text
end b64
on run argv
try
set answerText to "done"
{body}
return "OK" & linefeed & answerText
on error errorMessage number errorNumber
return "ERROR" & linefeed & my b64(errorMessage & " (" & errorNumber & ")")
end try
end run"""
    if platform.system() != "Darwin" or not Path("/usr/bin/osascript").is_file():
        raise SkillError("Finder requires macOS and /usr/bin/osascript", 2)
    try:
        result = subprocess.run(
            ["/usr/bin/osascript", "-e", script, "--", *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as error:
        raise SkillError("Finder Automation did not respond", 2 if isinstance(error, FileNotFoundError) else 1) from error
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or "osascript failed"
        code = 2 if any(token in detail.lower() for token in ("-1743", "not authorized", "not permitted")) else 1
        raise SkillError(detail, code)
    lines = result.stdout.rstrip("\n").split("\n")
    if not lines or lines[0] != "OK":
        detail = base64.b64decode(lines[1]).decode() if len(lines) > 1 and lines[0] == "ERROR" else result.stdout.strip()
        code = 2 if any(token in detail.lower() for token in ("-1743", "not authorized", "not permitted")) else 1
        raise SkillError(detail or "Finder returned no response", code)
    return lines[1:] if len(lines) > 1 and lines[1] else []


def path_arg(value: str, *, directory: bool = False, follow_links: bool = True) -> Path:
    """Resolve a required path and report missing targets as app errors."""
    # Path("") means the current directory; an empty operand must never become a Finder target.
    if not value.strip():
        raise SkillError("path must be a nonempty argument", 2)
    if not follow_links:
        # Destructive commands act on the named entry itself: a symlink must not redirect them to its target.
        path = Path(value).expanduser().absolute()
        if not path.is_symlink() and not path.exists():
            raise SkillError(f"path not found: {path}")
        return path
    path = Path(value).expanduser().resolve()
    if not path.exists():
        raise SkillError(f"path not found: {path}")
    if directory and not path.is_dir():
        raise SkillError(f"not a directory: {path}")
    return path


def tags_for(path: Path) -> list[str]:
    """Read Finder tags from the metadata xattr."""
    listing = subprocess.run(["/usr/bin/xattr", str(path)], capture_output=True, text=True, check=False)
    if listing.returncode:
        raise SkillError(listing.stderr.strip() or f"could not list metadata on {path}")
    if ATTR not in listing.stdout.splitlines():
        return []
    result = subprocess.run(["/usr/bin/xattr", "-px", ATTR, str(path)], capture_output=True, text=True, check=False)
    if result.returncode:
        raise SkillError(result.stderr.strip() or f"could not read Finder tags on {path}")
    try:
        values = plistlib.loads(bytes.fromhex(result.stdout))
    except (ValueError, plistlib.InvalidFileException) as error:
        raise SkillError(f"invalid Finder tag metadata on {path}") from error
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        raise SkillError(f"invalid Finder tag metadata on {path}")
    return [value.split("\n", 1)[0] for value in values]


def set_tags(path: Path, values: list[str]) -> dict[str, JsonValue]:
    """Replace Finder tags through the metadata xattr."""
    if any(not value or "\x00" in value for value in values):
        raise SkillError("tags must be nonempty and contain no NUL characters", 2)
    encoded = [value if "\n" in value else f"{value}\n0" for value in values]
    payload = plistlib.dumps(encoded, fmt=plistlib.FMT_BINARY, sort_keys=False).hex()
    result = subprocess.run(["/usr/bin/xattr", "-wx", ATTR, payload, str(path)], capture_output=True, text=True, check=False)
    if result.returncode:
        raise SkillError(result.stderr.strip() or f"could not set Finder tags on {path}")
    return {"path": str(path), "tags": [value.split("\n", 1)[0] for value in encoded]}


def parse_rows(lines: list[str]) -> list[dict[str, str | int]]:
    """Decode Finder listing rows."""
    rows: list[dict[str, str | int]] = []
    for line in lines:
        fields = line.split("\t")
        if len(fields) != 4:
            raise SkillError("Finder returned malformed listing data")
        try:
            rows.append({
                "name": base64.b64decode(fields[0]).decode(),
                "kind": base64.b64decode(fields[1]).decode(),
                "size": int(fields[2]),
                "modified": base64.b64decode(fields[3]).decode(),
            })
        except (ValueError, UnicodeDecodeError) as error:
            raise SkillError("Finder returned malformed listing values") from error
    return rows


def execute(args: argparse.Namespace) -> dict[str, JsonValue]:
    """Dispatch one parsed Finder command."""
    if args.command == "selection":
        body = """tell application "Finder"
set outputLines to {}
repeat with selectedItem in (get selection)
set end of outputLines to my b64(POSIX path of ((contents of selectedItem) as alias))
end repeat
set AppleScript's text item delimiters to linefeed
set answerText to outputLines as text
end tell"""
        return {"paths": [base64.b64decode(line).decode() for line in run_script(body)]}
    if args.command == "front":
        body = """tell application "Finder"
if (count of windows) = 0 then error "Finder has no open windows"
set answerText to POSIX path of ((target of front window) as alias)
end tell"""
        lines = run_script(body)
        return {"path": lines[0] if len(lines) == 1 else ""}
    if args.command == "list":
        path = path_arg(args.path, directory=True)
        body = """set targetAlias to POSIX file (item 1 of argv) as alias
tell application "Finder"
set targetFolder to folder targetAlias
set itemLimit to (item 2 of argv) as integer
set outputLines to {}
set itemCount to count of items of targetFolder
repeat with itemIndex from 1 to itemCount
if itemLimit = 0 or (count of outputLines) < itemLimit then
set fileItem to item itemIndex of targetFolder
set end of outputLines to (my b64(name of fileItem as text) & (character id 9) & my b64(kind of fileItem as text) & (character id 9) & (size of fileItem as text) & (character id 9) & my b64(modification date of fileItem as text))
end if
end repeat
set AppleScript's text item delimiters to linefeed
set answerText to outputLines as text
end tell"""
        return {"path": str(path), "items": parse_rows(run_script(body, str(path), str(args.limit))), "limit": args.limit or None}
    path = path_arg(args.path, follow_links=args.command != "trash") if args.command not in ("new-folder", "eject") else None
    if args.command == "reveal":
        run_script('set targetAlias to POSIX file (item 1 of argv) as alias\ntell application "Finder" to reveal targetAlias', str(path))
        return {"revealed": str(path)}
    if args.command == "open":
        run_script('set targetAlias to POSIX file (item 1 of argv) as alias\ntell application "Finder" to open targetAlias', str(path))
        return {"opened": str(path)}
    if args.command == "new-folder":
        parent = path_arg(args.parent, directory=True)
        if "/" in args.name or not args.name:
            raise SkillError("folder name must be a nonempty single path component", 2)
        body = """tell application "Finder"
set createdFolder to make new folder at (POSIX file (item 1 of argv)) with properties {name:(item 2 of argv)}
set answerText to POSIX path of (createdFolder as alias)
end tell"""
        return {"created": run_script(body, str(parent), args.name)[0]}
    if args.command == "tags":
        path = path_arg(args.path)
        return {"path": str(path), "tags": tags_for(path)}
    if args.command == "set-tags":
        path = path_arg(args.path)
        return set_tags(path, args.tags)
    if args.command == "info":
        body = """set targetAlias to POSIX file (item 1 of argv) as alias
tell application "Finder"
set targetItem to targetAlias
set itemName to name of targetItem as text
set itemKind to kind of targetItem as text
set itemSize to (size of targetItem) as text
set itemChanged to (modification date of targetItem) as text
set itemCreated to (creation date of targetItem) as text
set itemLocked to (locked of targetItem) as text
set itemComment to (comment of targetItem) as text
set answerText to my b64(POSIX path of targetItem) & (character id 9) & my b64(itemName) & (character id 9) & my b64(itemKind) & (character id 9) & itemSize & (character id 9) & my b64(itemChanged) & (character id 9) & my b64(itemCreated) & (character id 9) & itemLocked & (character id 9) & my b64(itemComment)
end tell"""
        fields = run_script(body, str(path))[0].split("\t")
        if len(fields) != 8:
            raise SkillError("Finder returned malformed info data")
        return {"path": base64.b64decode(fields[0]).decode(), "name": base64.b64decode(fields[1]).decode(), "kind": base64.b64decode(fields[2]).decode(), "size": int(fields[3]), "modified": base64.b64decode(fields[4]).decode(), "created": base64.b64decode(fields[5]).decode(), "locked": fields[6].lower() == "true", "comment": base64.b64decode(fields[7]).decode()}
    if args.command == "trash":
        if not args.yes:
            raise SkillError("trash requires --yes", 2)
        if path.is_symlink():
            # Finder's alias coercion follows symlinks and would trash the target; NSFileManager moves the link itself.
            run_script(
                "set fileURL to current application's NSURL's fileURLWithPath:(item 1 of argv)\n"
                "set {didTrash, trashError} to current application's NSFileManager's defaultManager()'s "
                "trashItemAtURL:fileURL resultingItemURL:(missing value) |error|:(reference)\n"
                "if not (didTrash as boolean) then error ((trashError's localizedDescription()) as text)",
                str(path),
            )
        else:
            run_script('set targetAlias to POSIX file (item 1 of argv) as alias\ntell application "Finder" to delete targetAlias', str(path))
        return {"trashed": str(path)}
    if not args.yes:
        raise SkillError("eject requires --yes", 2)
    run_script('set targetAlias to POSIX file (item 1 of argv) as alias\ntell application "Finder" to eject targetAlias', args.volume)
    return {"ejected": args.volume}


def parser() -> argparse.ArgumentParser:
    """Build the command-line parser."""
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("selection")
    commands.add_parser("front")
    listing = commands.add_parser("list")
    listing.add_argument("path")
    listing.add_argument("--limit", type=int, default=0)
    for name in ("reveal", "open", "tags", "info"):
        command = commands.add_parser(name)
        command.add_argument("path")
    folder = commands.add_parser("new-folder")
    folder.add_argument("parent")
    folder.add_argument("name")
    tagged = commands.add_parser("set-tags")
    tagged.add_argument("path")
    tagged.add_argument("tags", nargs="+")
    for name in ("trash", "eject"):
        command = commands.add_parser(name)
        command.add_argument("path" if name == "trash" else "volume")
        command.add_argument("--yes", action="store_true")
    return root


def emit(result: dict[str, JsonValue], as_json: bool) -> None:
    """Print a successful result."""
    if as_json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        for key, value in result.items():
            print(f"{key}: {value}")


def main(argv: list[str] | None = None) -> int:
    """Run the Finder CLI."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    as_json = "--json" in arguments
    arguments = [argument for argument in arguments if argument != "--json"]
    try:
        result = execute(parser().parse_args(arguments))
    except SkillError as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        return error.code
    emit(result, as_json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
