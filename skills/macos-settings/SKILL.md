---
name: macos-settings
description: "Read macOS settings; set appearance, volume, Wi-Fi power; open Settings panes. Use for a Mac setting or pane. Not for health metrics (sys-health)."
version: 1.0.2
license: MIT
when_to_use: "Use on macOS when asked to inspect or change appearance, volume, Wi-Fi, Bluetooth status, battery, sleep settings, or to open a System Settings pane. Require an explicit request and --yes before changing Wi-Fi power."
metadata:
  agentskills:
    tags: [macos, tahoe, system-settings, appearance, volume, wifi, bluetooth, battery]
---

# macOS Settings

Run from this skill directory with Python 3.12+; the script uses only the
standard library and macOS's built-in tools. The host terminal needs Automation
access to System Settings and System Events for pane navigation and appearance.
No Accessibility permission or UI keystrokes are used.

```bash
python3 scripts/macos_settings.py --json panes
python3 scripts/macos_settings.py --json open wifi
python3 scripts/macos_settings.py --json open displays
python3 scripts/macos_settings.py --json open "privacy accessibility"
python3 scripts/macos_settings.py --json open com.apple.settings.PrivacySecurity.extension --anchor Privacy_Accessibility
python3 scripts/macos_settings.py --json status             # appearance, volume, wifi, battery, sleep, focus
python3 scripts/macos_settings.py --json appearance toggle   # or dark / light
python3 scripts/macos_settings.py --json volume 35            # 0..100, preserves mute
python3 scripts/macos_settings.py --json volume mute          # or unmute
python3 scripts/macos_settings.py --json wifi off --dry-run   # shows networksetup argv; changes nothing
python3 scripts/macos_settings.py --json wifi off --yes       # explicitly permitted connectivity change
python3 scripts/macos_settings.py --json bluetooth
```

`--json` works before or after a subcommand; otherwise output is human-readable.
`panes` enumerates the live System Settings dictionary, rather than assuming
older pane IDs. `open` accepts IDs and case/spacing/punctuation-insensitive
names; an unknown name returns suggestions. `--anchor` uses the System Settings
AppleScript `reveal anchor` command; valid anchors depend on the installed
macOS version. `privacy accessibility` is the Privacy & Security accessibility
permission view. A pane opens in the already-running System Settings app.

## Boundaries

- **Read-only:** `panes`, `status`, `bluetooth`, and `wifi ... --dry-run`.
  Bluetooth power can be inspected with `system_profiler`, but cannot be
  toggled by this stdlib-only skill. `focus` (Do Not Disturb) is always `null`:
  macOS exposes no stable unprivileged interface for its live state.
  Wi-Fi SSID is `null` when disconnected or unavailable without privileges.
- **Local changes:** `open` changes the visible pane; `appearance` and `volume`
  change the user's current display/audio preferences. `volume N` preserves
  the mute flag. Restore prior values when performing exploratory checks.
- **Explicit gate:** `wifi on|off` requires `--yes` because turning Wi-Fi off
  can disconnect this machine. `--dry-run` only prints the exact
  `networksetup -setairportpower` argv and never requires `--yes`.
- **UI toggles inside a pane** are not scripted here. For clicks, typing, or window control that this helper doesn't cover, use the `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`); never write an ad-hoc input script or use OmO's native computer-use. Do that only when the user named the exact control.
- **Admin operations are not supported:** no privileged `sudo`, system-wide
  privacy/TCC edits, managed settings, sleep changes, or network service
  creation. Some macOS configurations also restrict Wi-Fi power changes;
  the CLI reports that failure without escalating privileges.

Exit `0` means success, `1` means an app/state or unknown-pane error (JSON
contains `"error"`), and `2` means usage, permission, non-macOS, or a missing
Wi-Fi confirmation. Python's argument parser also exits `2` for bad arguments.
