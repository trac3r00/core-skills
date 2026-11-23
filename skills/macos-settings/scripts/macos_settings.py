#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# How to run: python3 scripts/macos_settings.py --json status
"""Read and change common macOS settings without synthetic input.

Exit codes: 0 success, 1 app/state error, 2 usage, permission or non-macOS.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final, TypeAlias, assert_never, override

sys.dont_write_bytecode = True

JsonValue: TypeAlias = str | int | bool | None | list["JsonValue"] | list[str] | list[dict[str, str]] | dict[str, "JsonValue"]
Result: TypeAlias = dict[str, JsonValue]
PERMISSION_ERRORS: Final = ("-1743", "not authorized", "not permitted", "permission denied")


class Action(StrEnum):
    PANES = "panes"
    OPEN = "open"
    STATUS = "status"
    APPEARANCE = "appearance"
    VOLUME = "volume"
    WIFI = "wifi"
    BLUETOOTH = "bluetooth"


class Options(argparse.Namespace):
    action: str = ""
    json: bool = False
    pane: str = ""
    anchor: str | None = None
    value: str = ""
    state: str = ""
    yes: bool = False
    dry_run: bool = False


@dataclass(frozen=True, slots=True)
class SettingsError(Exception):
    detail: str
    code: int = 1
    extra: Result = field(default_factory=dict)

    @override
    def __str__(self) -> str:
        return self.detail


def command(argv: list[str]) -> str:
    try:
        process = subprocess.run(argv, capture_output=True, text=True, check=False, timeout=25)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise SettingsError(f"{argv[0]} failed: {error}") from error
    if process.returncode:
        detail = process.stderr.strip() or process.stdout.strip()
        code = 2 if any(reason in detail.casefold() for reason in PERMISSION_ERRORS) else 1
        raise SettingsError(f"{argv[0]}: {detail}", code=code)
    return process.stdout.strip()


def script(body: str) -> str:
    return command(["/usr/bin/osascript", "-e", body])


def appearance() -> bool:
    return script('tell application "System Events" to get dark mode of appearance preferences') == "true"


def volume() -> tuple[int, bool]:
    raw = script("""set settingsValue to get volume settings
return (output volume of settingsValue as text) & tab & (output muted of settingsValue as text)""")
    level, muted = raw.split("\t", 1)
    return int(level), muted == "true"


def wifi_device() -> str:
    ports = command(["/usr/sbin/networksetup", "-listallhardwareports"])
    match = re.search(r"Hardware Port: Wi-Fi\s*\nDevice: (\w+)", ports)
    if match is None:
        raise SettingsError("this Mac has no Wi-Fi hardware port")
    return match.group(1)


def wifi_state() -> Result:
    device = wifi_device()
    power = command(["/usr/sbin/networksetup", "-getairportpower", device])
    try:
        network = command(["/usr/sbin/networksetup", "-getairportnetwork", device])
    except SettingsError as error:
        if error.code != 2:
            raise
        network = ""
    ssid = network.partition(": ")[2] if network.startswith("Current Wi-Fi Network: ") else None
    return {"device": device, "power": power.rpartition(": ")[2].lower(), "ssid": ssid}


def battery() -> Result:
    raw = command(["/usr/bin/pmset", "-g", "batt"])
    found = re.search(r"(\d+)%;\s*([^;]+)", raw)
    source = re.search(r"Now drawing from '([^']+)'", raw)
    if found is None or source is None:
        raise SettingsError(f"could not parse pmset battery state: {raw}")
    return {"percent": int(found.group(1)), "power_source": source.group(1), "charging": found.group(2).strip() == "charging"}


def sleep_settings() -> Result:
    result: Result = {}
    section: str | None = None
    for line in command(["/usr/bin/pmset", "-g", "custom"]).splitlines():
        if line.endswith(" Power:"):
            section = "battery" if line == "Battery Power:" else "ac"
            result[section] = {}
        elif section is not None:
            fields = line.split()
            if len(fields) == 2 and fields[0] in ("sleep", "displaysleep"):
                settings = result[section]
                if isinstance(settings, dict):
                    settings[fields[0]] = int(fields[1])
    return result


def bluetooth() -> Result:
    raw = command(["/usr/sbin/system_profiler", "SPBluetoothDataType", "-json"])
    state = re.search(r'"controller_state"\s*:\s*"attrib_(on|off)"', raw)
    if state is None:
        raise SettingsError("system_profiler did not report Bluetooth power")
    return {"powered": state.group(1) == "on"}


def snapshot() -> Result:
    level, muted = volume()
    return {
        "appearance": "dark" if appearance() else "light",
        "volume": {"level": level, "muted": muted},
        "wifi": wifi_state(),
        "battery": battery(),
        "sleep": sleep_settings(),
        "focus": None,
        "hostname": command(["/bin/hostname"]),
        "macos_version": command(["/usr/bin/sw_vers", "-productVersion"]),
    }

PANES_SCRIPT = """tell application "System Settings"
    set rows to {}
    repeat with p in (every pane)
        set end of rows to ((id of p as text) & tab & (name of p as text))
    end repeat
end tell
set AppleScript's text item delimiters to linefeed
return rows as text"""


def applescript(script: str, *arguments: str) -> str:
    return command(["/usr/bin/osascript", "-e", script, "--", *arguments])


def panes() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line in applescript(PANES_SCRIPT).splitlines():
        pane_id, _, name = line.partition("\t")
        if pane_id:
            rows.append({"id": pane_id, "name": name or "General"})
    if not rows:
        raise SettingsError("System Settings returned no panes")
    return rows


def key(value: str) -> str:
    return "".join(char.casefold() for char in value if char.isalnum())


def select_pane(wanted: str, available: list[dict[str, str]]) -> dict[str, str]:
    wanted_key = key(wanted)
    if wanted_key == "privacyaccessibility":
        wanted_key = "privacysecurity"
    matches = [pane for pane in available if wanted_key == key(pane["id"]) or wanted_key == key(pane["name"])]
    if not matches:
        matches = [pane for pane in available if wanted_key and wanted_key in key(pane["name"])]
    if len(matches) == 1:
        return matches[0]
    suggestions = [pane["name"] for pane in matches] or difflib.get_close_matches(
        wanted, [pane["name"] for pane in available], n=5, cutoff=0.3,
    )
    raise SettingsError(f"unknown or ambiguous pane: {wanted}", extra={"suggestions": suggestions})


def open_pane(wanted: str, anchor: str | None) -> Result:
    pane = select_pane(wanted, panes())
    pane_id = pane["id"]
    if key(wanted) == "privacyaccessibility" and anchor is None:
        anchor = "Privacy_Accessibility"
    if anchor is None:
        _ = applescript('on run argv\n tell application "System Settings" to reveal pane id (item 1 of argv)\nend run', pane_id)
    else:
        _ = applescript(
            'on run argv\n tell application "System Settings" to reveal anchor (item 2 of argv) of pane id (item 1 of argv)\nend run',
            pane_id, anchor,
        )
    return {"opened": pane["name"], "id": pane_id, "anchor": anchor}


def change_appearance(choice: str) -> Result:
    before = appearance()
    desired = (not before) if choice == "toggle" else choice == "dark"
    _ = applescript(
        'on run argv\n tell application "System Events" to set dark mode of appearance preferences to (item 1 of argv is "true")\nend run',
        str(desired).lower(),
    )
    return {"before": "dark" if before else "light", "after": "dark" if desired else "light"}


def change_volume(value: str) -> Result:
    before, muted = volume()
    if value in ("mute", "unmute"):
        _ = applescript('on run argv\n set volume output muted (item 1 of argv is "mute")\nend run', value)
        return {"level": before, "before_muted": muted, "muted": value == "mute"}
    if not re.fullmatch(r"\d{1,3}", value) or int(value) > 100:
        raise SettingsError("volume must be 0..100, mute or unmute", code=2)
    _ = applescript(
        'on run argv\n set volume output volume (item 1 of argv as integer)\n' +
        ' if item 2 of argv is "true" then set volume output muted true\nend run',
        value, str(muted).lower(),
    )
    return {"before": before, "level": int(value), "muted": muted}


def change_wifi(state: str, confirmed: bool, dry_run: bool) -> Result:
    device = wifi_device()
    argv = ["/usr/sbin/networksetup", "-setairportpower", device, state]
    if not dry_run and not confirmed:
        raise SettingsError("Wi-Fi power can drop connectivity; rerun with --yes or inspect with --dry-run", code=2)
    if not dry_run:
        _ = command(argv)
    return {"device": device, "power": state, "dry_run": dry_run, "command": argv}


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    _ = root.add_argument("--json", action="store_true", help="print machine-readable JSON")
    sub = root.add_subparsers(dest="action", required=True)
    _ = sub.add_parser("panes", help="list live System Settings pane IDs and names")
    opened = sub.add_parser("open", help="open a pane by ID or fuzzy name")
    _ = opened.add_argument("pane")
    _ = opened.add_argument("--anchor", help="pane's AppleScript anchor ID")
    _ = sub.add_parser("status", help="one snapshot of common settings")
    theme = sub.add_parser("appearance", help="set or toggle the appearance")
    _ = theme.add_argument("value", choices=("dark", "light", "toggle"))
    audio = sub.add_parser("volume", help="set volume 0..100 or mute/unmute")
    _ = audio.add_argument("value")
    wireless = sub.add_parser("wifi", help="set Wi-Fi power")
    _ = wireless.add_argument("state", choices=("on", "off"))
    _ = wireless.add_argument("--yes", action="store_true", help="confirm connectivity change")
    _ = wireless.add_argument("--dry-run", action="store_true", help="print networksetup argv only")
    _ = sub.add_parser("bluetooth", help="read Bluetooth controller power")
    for child in sub.choices.values():
        _ = child.add_argument("--json", action="store_true", default=argparse.SUPPRESS)
    return root


def execute(args: Options) -> Result:
    action = Action(args.action)
    match action:
        case Action.PANES:
            return {"panes": panes()}
        case Action.OPEN:
            return open_pane(args.pane, args.anchor)
        case Action.STATUS:
            return snapshot()
        case Action.APPEARANCE:
            return change_appearance(args.value)
        case Action.VOLUME:
            return change_volume(args.value)
        case Action.WIFI:
            return change_wifi(args.state, args.yes, args.dry_run)
        case Action.BLUETOOTH:
            return bluetooth()
    assert_never(action)


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv, namespace=Options())
    if sys.platform != "darwin":
        print(json.dumps({"error": "macos-settings requires macOS"}))
        return 2
    try:
        result = execute(args)
    except SettingsError as error:
        print(json.dumps({"error": str(error), **error.extra}, ensure_ascii=False))
        return error.code
    if args.json is True:
        print(json.dumps(result, ensure_ascii=False))
    else:
        for label, value in result.items():
            print(f"{label}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
