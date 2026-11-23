"""Shared AppleScript transport and document ownership for Office commands."""

from __future__ import annotations

import base64
import os
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path

# Office's shared group container: every Office app may read and write here without a sandbox
# "Grant File Access" prompt, so documents are staged here and the helper moves the result.
STAGE_ROOT = Path.home() / "Library" / "Group Containers" / "UBF8T346G9.Office" / "omo-moffice"
SUFFIX = {"word": ".docx", "excel": ".xlsx", "powerpoint": ".pptx"}
_CREATES = {("word", "create"), ("excel", "new"), ("powerpoint", "create")}
_EDITS = {("word", "append"), ("word", "replace"), ("powerpoint", "add-slide")}


@dataclass(frozen=True, slots=True)
class OfficeError(Exception):
    detail: str

    def __str__(self) -> str:
        return self.detail


def text(value: str) -> str:
    """Quote a Python string as an AppleScript string literal."""
    pieces = value.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return " & linefeed & ".join(
        '"' + piece.replace("\\", "\\\\").replace('"', '\\"') + '"'
        for piece in pieces
    )


def decode(value: str) -> str:
    return base64.b64decode(value).decode("utf-8")


def existing(path: str) -> Path:
    file = Path(path).expanduser().resolve()
    if not file.is_file():
        raise OfficeError(f"file not found: {file}")
    return file


def destination(path: str, suffix: str) -> Path:
    file = Path(path).expanduser().resolve()
    if file.suffix.lower() != suffix or not file.parent.is_dir():
        raise OfficeError(f"expected a {suffix} path in an existing directory: {file}")
    return file


def _publish(source: Path, target: Path, *, exclusive: bool) -> None:
    """Copy beside the target, then rename, so the user's file is replaced whole or not at all."""
    temporary = target.with_name(f".{target.name}.moffice-{uuid.uuid4().hex}")
    try:
        shutil.copy2(source, temporary)
        if exclusive and target.exists():
            raise OfficeError(f"file already exists: {target}")
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


class staged:
    """Point the command at copies in Office's container; publish only after success; always clean up.

    A plain context manager: contextlib's generator form re-raises by setting ``__traceback__``, which
    the frozen ``OfficeError`` does not allow.
    """

    def __init__(self, options) -> None:
        self.options = options
        self.private: Path | None = None
        self.publish: list[tuple[Path, Path, bool]] = []

    def __enter__(self) -> dict[str, str]:
        options = self.options
        app, action = options.app, getattr(options, "action", None)
        if app == "apps" or not STAGE_ROOT.parent.is_dir():
            return {}
        real_file = Path(options.file).expanduser().resolve()
        creates = (app, action) in _CREATES or ((app, action) == ("excel", "write") and not real_file.exists())
        edits = (app, action) in _EDITS or ((app, action) == ("excel", "write") and real_file.exists())
        if creates:
            destination(options.file, SUFFIX[app])
            if real_file.exists():
                raise OfficeError(f"file already exists: {real_file}")
        else:
            existing(options.file)
        real_out = destination(options.out, ".pdf") if action == "export-pdf" else None
        STAGE_ROOT.mkdir(parents=True, exist_ok=True)
        self.private = Path(tempfile.mkdtemp(prefix="stage-", dir=STAGE_ROOT))
        staged_file = self.private / real_file.name
        if not creates:
            shutil.copy2(real_file, staged_file)
        options.file = str(staged_file)
        mapping = {str(staged_file): str(real_file)}
        if creates or edits:
            self.publish.append((staged_file, real_file, creates))
        if real_out is not None:
            staged_out = self.private / real_out.name
            options.out = str(staged_out)
            mapping[str(staged_out)] = str(real_out)
            self.publish.append((staged_out, real_out, False))
        return mapping

    def __exit__(self, kind, value, traceback) -> bool:
        try:
            if kind is None:
                for source, target, exclusive in self.publish:
                    _publish(source, target, exclusive=exclusive)
        finally:
            if self.private is not None:
                shutil.rmtree(self.private, ignore_errors=True)
        return False


def _is_running(app: str) -> bool:
    return subprocess.run(["/usr/bin/pgrep", "-x", f"Microsoft {app}"], capture_output=True, check=False).returncode == 0


def _hang_error(app: str, was_running: bool) -> str:
    detail = (
        f"Microsoft {app} did not respond within 30 s; an Office dialog or a pending Automation "
        f"permission prompt may be waiting in {app}."
    )
    if was_running or not _is_running(app):
        return detail
    # The helper launched it, so it must not stay open behind the error.
    try:
        subprocess.run(
            ["/usr/bin/osascript", "-e", f'with timeout of 10 seconds\ntell application "Microsoft {app}" to quit saving no\nend timeout'],
            capture_output=True, text=True, check=False, timeout=15,
        )
    except subprocess.TimeoutExpired:
        pass
    if _is_running(app):
        return detail + f" {app} was left open because it did not accept Quit; answer or close its dialog."
    return detail + f" {app} was quit."


def run(app: str, body: str, *args: str) -> list[str]:
    """Own only the document opened here; restore the app's running state."""
    script = f"""use framework "Foundation"
on b64(value)
    set dataValue to ((current application's NSString's stringWithString:(value as text))'s dataUsingEncoding:(current application's NSUTF8StringEncoding))
    return (dataValue's base64EncodedStringWithOptions:0) as text
end b64
on run argv
    set wasRunning to application "Microsoft {app}" is running
    set ownedDoc to missing value
    try
        tell application "Microsoft {app}"
{body}
        end tell
        if not wasRunning then tell application "Microsoft {app}" to quit
        return "OK" & linefeed & answerText
    on error errMsg number errNum
        try
            if ownedDoc is not missing value then
                tell application "Microsoft {app}" to close ownedDoc saving no
            end if
        end try
        if not wasRunning then
            try
                tell application "Microsoft {app}" to quit
            end try
        end if
        return "ERROR" & linefeed & my b64(errMsg & " (" & errNum & ")")
    end try
end run"""
    was_running = _is_running(app)
    try:
        result = subprocess.run(
            ["/usr/bin/osascript", "-e", script, "--", *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except subprocess.TimeoutExpired as error:
        raise OfficeError(_hang_error(app, was_running)) from error
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip()
        if "-1743" in detail:
            raise OfficeError(_automation_error(app))
        if "-1712" in detail:
            raise OfficeError(_hang_error(app, was_running))
        raise OfficeError(detail)
    status, _, payload = result.stdout.rstrip("\n").partition("\n")
    if status == "ERROR":
        detail = decode(payload)
        if "-1743" in detail:
            raise OfficeError(_automation_error(app))
        if "-1712" in detail:
            raise OfficeError(_hang_error(app, was_running))
        raise OfficeError(detail)
    if status != "OK":
        raise OfficeError(f"unexpected {app} response: {result.stdout.strip()}")
    return payload.split("\n") if payload else []


def _automation_error(app: str) -> str:
    return (
        f"Microsoft {app} Automation access is denied; enable it under System Settings > Privacy & "
        f"Security > Automation > <host app> > Microsoft {app}.app."
    )


def guard(file: Path, collection: str) -> str:
    """Reject matching open names before opening a file owned by the user."""
    return f"""            repeat with candidateDoc in (get {collection})
                if (name of candidateDoc) is {text(file.name)} then error {text(f"document already open: {file.name}")}
            end repeat
"""
