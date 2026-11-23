#!/usr/bin/env python3
"""Capture macOS app windows, screens, or interactive regions."""

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# The macOS binaries behind the platform boundary; the env overrides let the CLI contract run with stand-ins off macOS.
CAPTURE = os.environ.get("APPSHOT_SCREENCAPTURE", "/usr/sbin/screencapture")
OSASCRIPT = os.environ.get("APPSHOT_OSASCRIPT", "osascript")


def list_windows() -> tuple[list[dict[str, str]], list[dict[str, str]], str | None]:
    # Fields are joined with the ASCII unit separator, which cannot occur in a process name.
    script = """set sep to (ASCII character 31)
tell application "System Events"
set winList to {}
repeat with p in (every process whose visible is true)
  set appName to name of p
  try
    set winCount to count of windows of p
    if winCount > 0 then set end of winList to ("W" & sep & appName & sep & winCount & " window(s)")
  on error errorMessage
    set end of winList to ("E" & sep & appName & sep & errorMessage)
  end try
end repeat
set AppleScript's text item delimiters to (ASCII character 30)
return winList as string
end tell"""
    result = subprocess.run(
        [OSASCRIPT, "-e", script],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return [], [], result.stderr.strip() or "window enumeration failed"
    windows: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []
    # Records are framed by the ASCII record separator, so a multi-line error message stays one record.
    for line in (result.stdout or "").rstrip("\n").split("\x1e"):
        kind, _, rest = line.partition("\x1f")
        app, _, detail = rest.partition("\x1f")
        if kind == "W":
            windows.append({"app": app, "info": detail.strip()})
        elif kind == "E":
            skipped.append({"app": app, "error": detail.strip()})
    return windows, skipped, None


def capture_app(app_name: str, output: str) -> tuple[bool, str]:
    activate = subprocess.run(
        [
            OSASCRIPT,
            "-e",
            'on run argv\ntell application "System Events" to set frontmost of process (item 1 of argv) to true\nend run',
            app_name,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if activate.returncode != 0:
        return False, f"app activation failed for {app_name}: {activate.stderr.strip() or f'exit {activate.returncode}'}"

    window = subprocess.run(
        [
            OSASCRIPT,
            "-l",
            "JavaScript",
            "-e",
            """ObjC.import("CoreGraphics");
function run(argv) {
  const raw = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements, $.kCGNullWindowID);
  const windows = ObjC.deepUnwrap(ObjC.castRefToObject(raw));
  const match = windows.find((w) => w.kCGWindowOwnerName === argv[0] && w.kCGWindowLayer === 0);
  if (!match) throw new Error("no on-screen window owned by " + argv[0]);
  return String(match.kCGWindowNumber);
}""",
            app_name,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if window.returncode != 0:
        return False, f"window lookup failed for {app_name}: {window.stderr.strip() or 'no window number returned'}"
    if not window.stdout.strip().isdigit():
        return False, f"invalid window ID for {app_name}: {window.stdout.strip()!r}"
    command = [CAPTURE, "-l", window.stdout.strip()]
    command.append(output)
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        return False, result.stderr.strip() or "capture failed"
    return True, output


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "appshot").splitlines()[0])
    parser.add_argument("--screen", action="store_true")
    parser.add_argument("--app")
    parser.add_argument("--region", action="store_true")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--out")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not Path(CAPTURE).exists():
        print("error: screencapture not found — macOS required", file=sys.stderr)
        return 2
    if shutil.which(OSASCRIPT) is None:
        print("error: osascript not found — macOS required", file=sys.stderr)
        return 2
    if args.list:
        # "is not None": an explicit empty value is still a conflicting argument.
        if args.screen or args.region or args.app is not None or args.out is not None:
            parser.error("--list cannot be combined with --screen, --app, --region, or --out")
        windows, skipped, error = list_windows()
        if error:
            print(f"error: window enumeration failed: {error}", file=sys.stderr)
            return 1
        if args.json:
            print(json.dumps({"windows": windows, **({"skipped": skipped} if skipped else {})}, indent=2))
        else:
            for window in windows:
                print(f"{window['app']:<30} {window['info']}")
            print(f"\n{len(windows)} app(s) with capturable windows")
            for item in skipped:
                print(f"warning: could not count windows of {item['app']}: {item['error']}", file=sys.stderr)
        return 0 if windows else 1
    if not args.out:
        parser.error("--out FILE required for captures")
    if args.app == "":
        parser.error("--app needs an application name")
    if sum((args.screen, args.app is not None, args.region)) > 1:
        parser.error("pass only one of --screen, --app NAME, or --region")
    if not (args.screen or args.region or args.app):
        parser.error("pass --screen, --app NAME, --region, or --list")
    if args.out != "-" and Path(args.out).is_dir():
        parser.error(f"--out must be a file path, not a directory: {args.out}")

    # The native tool writes a private temp file, so a zero exit with no output, a stale file at --out, or a
    # concurrent run sharing the same path can never be reported as this invocation's capture.
    suffix = Path(args.out).suffix if args.out != "-" and Path(args.out).suffix else ".png"
    # Beside --out, publication is an atomic same-filesystem rename; stdout mode uses the system temp dir.
    # The parent of the entry itself (a symlinked --out is replaced, not followed), so os.replace stays on one filesystem.
    parent = None if args.out == "-" else str(Path(args.out).absolute().parent.resolve())
    with tempfile.TemporaryDirectory(prefix="appshot-capture-", dir=parent) as private:
        capture = str(Path(private) / f"capture{suffix}")
        if args.screen:
            command = [CAPTURE, "-x", capture]
        elif args.region:
            command = [CAPTURE, "-i", capture]
        elif args.app:
            ok, message = capture_app(args.app, capture)
            if not ok:
                print(f"error: {message}", file=sys.stderr)
                return 1
            command = []
        else:
            parser.error("pass --screen, --app NAME, --region, or --list")

        if command:
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                print(f"capture failed: {result.stderr.strip()}", file=sys.stderr)
                return 1

        captured = Path(capture)
        size = captured.stat().st_size if captured.exists() else 0
        if size == 0:
            print(f"error: no new capture was written to {args.out}", file=sys.stderr)
            return 1
        if args.out == "-":
            print(base64.b64encode(captured.read_bytes()).decode(), end="")
            return 0
        os.replace(capture, args.out)
    if args.json:
        print(json.dumps({"captured": args.out, "bytes": size}))
    else:
        print(f"captured: {args.out} ({size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
