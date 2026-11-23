---
name: apple-suite
description: "Script Apple apps (Notes, Reminders, Calendar, Mail, Maps, Contacts, Shortcuts) via AppleScript. Use for those apps. Not for calls (phone-facetime)."
version: 1.0.2
license: MIT
when_to_use: "Use when the user explicitly asks to inspect or change an Apple built-in app on macOS. Mutating actions such as creating notes, completing reminders, running Terminal commands, or running Shortcuts require an explicit user request."
metadata:
  agentskills:
    tags: [macos, apple, notes, reminders, maps, mail, calendar, terminal, contacts, photos, automation]
---

# Apple Suite

`scripts/apple_suite.py` drives macOS built-in apps with `osascript` and URL
schemes. It is local, needs no API keys, and makes no network request itself.
Run it from this skill's directory.

## Commands

`--json` is a top-level flag: put it before the app name
(`apple_suite.py --json notes list`), not after the action.

```bash
python3 scripts/apple_suite.py notes list [--limit 20]
python3 scripts/apple_suite.py notes search "keyword"          # matches note titles
python3 scripts/apple_suite.py notes create --title "Title" --body "Body text"   # folder "Notes"
python3 scripts/apple_suite.py reminders list                  # incomplete only
python3 scripts/apple_suite.py reminders add --title "Task" [--due "2026-08-27 09:00"]
python3 scripts/apple_suite.py reminders complete --title "Task"   # first exact-title match
python3 scripts/apple_suite.py mail unread                     # inbox unread count
python3 scripts/apple_suite.py mail list [--limit 20]          # inbox: subject :: sender :: date
python3 scripts/apple_suite.py calendar list
python3 scripts/apple_suite.py calendar today
python3 scripts/apple_suite.py calendar add --title "Meeting" --date "2026-08-27 14:00" [--calendar "Work"]   # 1h event
python3 scripts/apple_suite.py contacts count
python3 scripts/apple_suite.py contacts search "Jane"
python3 scripts/apple_suite.py photos count
python3 scripts/apple_suite.py photos albums
python3 scripts/apple_suite.py shortcuts list
python3 scripts/apple_suite.py shortcuts run "Calculate Tip"
python3 scripts/apple_suite.py terminal run "echo hello"
python3 scripts/apple_suite.py maps search "coffee near me"    # opens Maps
python3 scripts/apple_suite.py maps open "1 Infinite Loop, Cupertino"
python3 scripts/apple_suite.py maps directions --from "Home" --to "Office"
python3 scripts/apple_suite.py appstore search "terminal"      # opens App Store
python3 scripts/apple_suite.py phone open "+1234567890"        # opens a tel: URL in FaceTime
```

`--due` and `--date` go to AppleScript `date "..."`, which parses them with the
Mac's locale settings. Without `--calendar`, the event goes to the first calendar.

## Procedure

1. Read first (`list`, `search`, `today`, `unread`, `count`) and quote what came back.
2. Run `notes create`, `reminders add`/`complete`, `calendar add`, `shortcuts run`,
   `terminal run` and `phone open` only when the user named that action and its content.
3. Done when the command exits `0` and prints a `status` (`created`, `added`,
   `completed`, `ran`, `opened`) or the requested data. Report it.
4. On exit `1` or `2`, report the error text. Do not retry with guessed names.

## Boundaries

- `terminal run` brings Terminal forward, runs the command in a new tab, waits
  2s and returns the tab contents. Use only for a command the user explicitly asked for.
- For calls and FaceTime use `phone-facetime`. `phone open` only hands a `tel:` URL to FaceTime.
- For clicks, typing, or window control this helper does not cover, use the
  `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`). Never write an ad-hoc input script or use
  OmO's native computer-use.
- Voice Memos, Passwords, Find My, and Activity Monitor have no supported
  AppleScript API. The helper has no command for them (argparse exits `2`).
- macOS only; exits `2` when `/usr/bin/osascript` is missing. macOS asks for
  Automation permission the first time each app is driven.
- Exit codes: `0` success, `1` app-level failure (AppleScript error, reminder
  not found), `2` usage or platform failure.
