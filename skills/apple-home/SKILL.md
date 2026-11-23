---
name: apple-home
description: "Read and control Apple Home via Home.app: rooms, accessory state, scenes, on/off toggles. Use for home devices. Not for Mac settings (macos-settings)."
version: 1.0.2
license: MIT
when_to_use: "Use when the user explicitly asks about or wants to change Apple Home devices from this Mac. Reading state is safe; toggles and scenes act on real devices, so run them only on an explicit request, and never touch locks, doors or garage doors unless the user named that exact action."
metadata:
  agentskills:
    tags: [macos, apple, home, homekit, smart-home, lights, scenes, accessibility, automation]
---

# Apple Home

Home.app has no AppleScript dictionary and HomeKit is closed to unsigned tools,
so `scripts/apple_home.py` drives Home.app's UI through the Accessibility API
(stdlib `ctypes` via `scripts/macax.py`, no pyobjc). It reads the same names and
states the tiles show and presses tiles like a person. It launches Home.app in
the background when needed. Run commands from this skill's directory.

## Commands

```bash
python3 scripts/apple_home.py --json status                  # home name, summary chips, rooms, categories
python3 scripts/apple_home.py rooms
python3 scripts/apple_home.py --json list                    # every accessory in every room with state
python3 scripts/apple_home.py list --room "Living Room"
python3 scripts/apple_home.py list --category Lights         # Climate | Lights | Speakers & TVs | Security | Energy
python3 scripts/apple_home.py scenes [--room "Kitchen"]
python3 scripts/apple_home.py run-scene "Good Night" --room "Bedroom"
python3 scripts/apple_home.py --json toggle "Floor Lamp" --room "Living Room" [--timeout 6]
python3 scripts/apple_home.py toggle "Front Door" --room "Front Foyer" --allow-security
python3 scripts/apple_home.py open [--room "Kitchen" | --category Lights]   # bring Home.app forward on a view
python3 scripts/apple_home.py screenshot --out /tmp/home.png [--room "Kitchen" | --category Lights]
```

- `--json` works before or after the subcommand.
- Names match case-insensitively, ignore extra spaces, and treat the curly
  apostrophe (U+2019) like `'`, so `"joshua's bedroom"` finds `Joshua’s Bedroom`.
- `list` and `scenes` visit each room in turn (about 1s per room), then return
  Home.app to the Home tab. `list --stay` leaves it on the last view.
- States are Home.app's own wording: `On`, `Off`, `100%`, `Locked`,
  `No Response 2h`, `Updating...`, `Paused`, `77°`.

## Procedure

1. Read with `--json status` or `list --room`. Answer state questions from that output only.
2. Run `toggle` or `run-scene` only when the user named that accessory or scene. Take the name and room from the user.
3. Done when `toggle` returns `before` and `after` (report both), or `run-scene` returns `triggered: true`.
   `run-scene` only confirms Home.app accepted the press; there is no per-scene completion state.
4. On exit `1`, show the error and any `options` list of valid names, then stop. Do not retry with guessed names.

## Boundaries

- `toggle` and `run-scene` change physical devices. Never run them without an explicit request.
- Security gate: an accessory whose state is locked/unlocked/open/closed (or
  locking, jammed, stopped, ...) or whose name contains lock, door, garage, gate,
  security, alarm or window is refused with exit `2` unless `--allow-security` is
  passed. Pass it only when the user explicitly asked to lock, unlock or open that accessory.
- `toggle` only flips on/off accessories (lights, switches, outlets, fans;
  dimmers flip between off and their last level). Other states (thermostats,
  media, blinds, brightness levels) exit `1`. For those, run `open --room` and
  let the user act in Home.app, unless they asked for that UI step by name.
- Accessories in `No Response` are refused; nothing is sent.
- Two accessories or scenes with the same name in one room are refused; ask the user to rename one.
- `toggle` exits `1` if the tile state does not change within `--timeout` seconds (default 6).
- Only the selected home is read. If the user has several homes, they switch in Home.app's toolbar first.
- For clicks, typing, or window control this helper does not cover, use the
  `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`). Never write an ad-hoc input script or use
  OmO's native computer-use.
- For Home automations the user built as Shortcuts, use `apple-suite shortcuts run`.

## Setup and exit codes

- macOS only. The process running the script (Terminal, iTerm, or the OmO host
  app) needs Accessibility permission (System Settings > Privacy & Security >
  Accessibility). `screenshot` also needs Screen Recording. A missing
  Accessibility grant exits `2` with that instruction.
- `0` success. `1` app-level failure: unknown room/accessory/scene (valid
  `options` listed), duplicate name, not an on/off accessory, no state change,
  or no response. `2` usage error, missing permission, non-macOS, or a gated
  security action.
