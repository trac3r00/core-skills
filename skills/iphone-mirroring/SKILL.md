---
name: iphone-mirroring
description: "Read and navigate iPhone Mirroring: state, screenshots, View menu; input goes via OpenCUA. Use for the iPhone from the Mac. Not for calls (phone-facetime)."
version: 1.1.0
license: MIT
when_to_use: "Use when the user explicitly asks to see or operate their iPhone through iPhone Mirroring. Reading state and screenshots are safe; taps, typing and app launches act on the real phone, so run them only for the user's request and never send messages, pay, delete, or change settings without their explicit go-ahead."
metadata:
  agentskills:
    tags: [macos, apple, iphone, iphone-mirroring, continuity, screenshot, automation, accessibility]
---

# iPhone Mirroring

iPhone Mirroring (macOS 15+) shows the phone in a Mac window but ships no
AppleScript dictionary. This skill reads its window through the Accessibility
API, presses its own View menu for navigation, and posts CoreGraphics
mouse/keyboard events for taps, swipes and keys (stdlib `ctypes`, no pyobjc).
The mirrored screen is only pixels, so **look before you tap**: take a
screenshot, read it, then act.

## Commands

Use the script for reading and View-menu navigation (Accessibility only, no synthetic input):

```bash
python3 scripts/iphone_mirroring.py --json status        # state, device, on-screen message, window frame
python3 scripts/iphone_mirroring.py open [--wait 20]     # bring forward, wait for a settled state
python3 scripts/iphone_mirroring.py retry [--wait 20]    # press "Try Again" / "Connect" / "Resume" after not_found, timed_out or paused
python3 scripts/iphone_mirroring.py screenshot --out "$SCRATCH/iphone.png"
python3 scripts/iphone_mirroring.py home                 # View > Home Screen
python3 scripts/iphone_mirroring.py app-switcher         # View > App Switcher
python3 scripts/iphone_mirroring.py spotlight            # View > Spotlight
```

**Taps, scrolling, typing, keys and app launches go through the `opencua`
skill** (OpenCUA, formerly apple-cua; CLI `opencua ios`, "Control an iPhone through iPhone Mirroring").
The user forbids ad-hoc input scripts and OmO's native computer-use, so don't
use this script's `tap`, `scroll`, `type`, `key` or `launch`; they post raw
CoreGraphics events. Read `opencua ios --help` for its subcommands before the
first input; this skill doesn't restate them.

## Working loop

1. `status`: act only when `state` is `connected`. Other states are
   `connecting`, `not_found`, `timed_out`, `paused`, `in_use` (unlocked and
   in use; mirroring needs it locked), `needs_unlock`, `needs_auth`,
   `disconnected`, `error`, `no_window` and `unknown`; `message` carries the app's text.
   For `not_found`, `timed_out` or `paused`, run `retry` once, then report.
2. `screenshot --out` and read the image. On Retina the PNG is 2x the window's
   point size (`window.width` x `window.height` from `status`).
3. Do one action (menu navigation here, input via OpenCUA), then screenshot again to confirm.
4. Stop when the screenshot shows the requested end state, or after one failed retry.

## Boundaries

- Everything except `status` and `screenshot` acts on the real phone. Stay
  inside what the user asked for; confirm before anything that sends,
  purchases, deletes, or changes settings, and never enter passcodes.
- Navigation commands exit `1` with the current `status` when the phone is not mirrored.
- The Mac user must be the one paired with the iPhone. The phone must be
  nearby, locked, and not in use; the Mac may ask for Touch ID or its password
  on connect, and only a person can approve that.

## Setup and exit codes

- macOS 15+ with iPhone Mirroring set up once by hand. The process running the
  script needs **Accessibility** (reading the window and menu presses) and **Screen
  Recording** (`screenshot`) under System Settings > Privacy & Security.
- `0` success, `1` app-level failure (not connected, menu item disabled,
  capture failed), `2` usage, permission, or non-macOS.
