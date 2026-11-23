---
name: apple-tv
description: "Read and control the macOS TV app via AppleScript: library search, now playing, playback. Use for TV.app on this Mac. Not for Spotify (spotify)."
version: 1.0.2
license: MIT
when_to_use: "Use for explicit requests about TV.app on this Mac; this skill does not control an Apple TV set-top box."
metadata:
  agentskills:
    tags: [macos, apple, tv, apple-tv, applescript, media]
---

# TV app

`scripts/apple_tv.py` uses TV.app's AppleScript dictionary only: no System
Events keystrokes, clicks, or browser automation. Run it from this skill's directory.

```bash
python3 scripts/apple_tv.py --json status
python3 scripts/apple_tv.py search "The Big Short"      # local library only, not Apple's catalog
python3 scripts/apple_tv.py play-item "The Big Short"   # needs one exact library name match
python3 scripts/apple_tv.py play                         # also: pause, toggle, next, previous
python3 scripts/apple_tv.py volume 35                   # 0-100, only during playback
```

- `status` returns `state`, `volume`, and, when not stopped, `name`, `show`,
  `album`, `duration` and `position` of the current track.
- `play-item` fails with exit `1` if no item or more than one item has that exact name.
- `volume` fails with exit `1` when playback is stopped (TV.app would defer the
  setting) or when TV.app keeps a different level.
- `--json` works before or after the command.

## Procedure

1. Read `--json status` before any change.
2. Change playback or volume only on request. Done when the command exits `0`;
   confirm with a second `--json status`.
3. TV.app may launch to answer AppleScript. After a temporary test, restore the
   prior playback and volume, and do not quit TV.app if another session was using it.

## Boundaries and exit codes

- This controls TV.app on this Mac, not an Apple TV set-top box.
- For clicks, typing, or window control this helper does not cover, use the
  `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`). Never write an ad-hoc input script or use
  OmO's native computer-use.
- `0` success, `1` app-level failure, `2` invalid usage, non-macOS, or missing
  Automation permission (AppleScript error -1743). Grant TV Automation
  permission to the process running the script.
