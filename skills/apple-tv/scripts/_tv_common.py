"""Private AppleScript transport for the macOS TV app skill."""

from __future__ import annotations

import base64
import subprocess
from typing import Protocol


class TVOptions(Protocol):
    """The fields supplied by the TV command parser."""

    action: str
    query: str
    name: str
    level: int


class TVError(Exception):
    """A recoverable command failure with an exit code."""

    def __init__(self, message: str, code: int = 1) -> None:
        super().__init__(message)
        self.code: int = code


def decoded(value: str) -> str:
    """Decode a TV AppleScript field without delimiter ambiguity."""
    return base64.b64decode(value).decode("utf-8")


def app_script(body: str, *arguments: str) -> list[str]:
    """Execute a dictionary command without synthetic input or forced app quit."""
    script = f"""use framework "Foundation"
on b64(value)
    set dataValue to ((current application's NSString's stringWithString:(value as text))'s dataUsingEncoding:(current application's NSUTF8StringEncoding))
    return (dataValue's base64EncodedStringWithOptions:0) as text
end b64
on run argv
    tell application id "com.apple.TV"
{body}
    end tell
end run"""
    try:
        result = subprocess.run(
            ["/usr/bin/osascript", "-e", script, "--", *arguments],
            capture_output=True, text=True, timeout=40, check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise TVError("TV app did not respond to AppleScript") from error
    if result.returncode:
        message = result.stderr.strip() or result.stdout.strip()
        raise TVError(message, 2 if "-1743" in message else 1)
    return result.stdout.rstrip("\n").split("\n")
