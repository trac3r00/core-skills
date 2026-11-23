---
name: phone-facetime
description: "Phone and FaceTime calls: preview and open call URLs, read call state, hang up, mute, recents. Use for calls on the Mac. Not for Messages (apple-suite)."
version: 1.0.2
license: MIT
when_to_use: "Use for macOS 26 Phone.app and FaceTime call tasks. Preview the exact call URL and ask the user to confirm before passing --yes; never place a real call merely to test the skill."
metadata:
  agentskills:
    tags: [macos, apple, phone, facetime, calls, accessibility, contacts]
---

# Phone and FaceTime

Phone.app (`com.apple.mobilephone`, with iPhone relay) and FaceTime
(`com.apple.FaceTime`) have no AppleScript dictionary. This stdlib-only script
opens native call URLs and reads app windows through the bundled, unchanged
`macax.py` Accessibility bridge. It never sends synthetic mouse or keyboard
events. Run from this skill directory or use an absolute script path.

## Commands

```bash
python3 scripts/phone_facetime.py call "+15551234567"          # prints tel:+15551234567, exits 2
python3 scripts/phone_facetime.py call "Exact Contact Name" --audio --dry-run
python3 scripts/phone_facetime.py call "+15551234567" --facetime --yes  # only after explicit confirmation
python3 scripts/phone_facetime.py --json status
python3 scripts/phone_facetime.py hangup
python3 scripts/phone_facetime.py mute
python3 scripts/phone_facetime.py unmute
python3 scripts/phone_facetime.py --json recents --limit 10
python3 scripts/phone_facetime.py open phone
python3 scripts/phone_facetime.py open facetime
```

`call` accepts a number or an exact Contacts name with exactly one matching
person and one phone number; ambiguous matches fail rather than guessing.
Number formatting is removed. `tel:`, `facetime:` (video), and
`facetime-audio:` are selected by the call flags. Without `--yes`, it prints
the **exact URL** it would open and exits `2`; show that URL to the user
and confirm the real call before retrying with `--yes`. `--dry-run` always
prints the URL and exits `0`, even when `--yes` was also passed.
`--json` is accepted before or after a command; refusal includes the URL and
`confirmation_required: true`.

`status` reports `idle`, `ringing`, or `in_call` from visible Phone/FaceTime
AX windows. It reports the participant and duration only when the call window
exposes them; it does not infer call state from recents or a running process.
`hangup`, `mute`, and `unmute` only AXPress a matching control in an active
call window and exit `1` if none is exposed. They never activate unrelated
windows or use coordinates.

`recents` first reads **visible** Phone recents rows (then FaceTime rows) by
AX; the output names that source. Otherwise it queries
`~/Library/Application Support/CallHistoryDB/CallHistory.storedata` using
SQLite `mode=ro`, and reports that exact path as its source. The store may
need Full Disk Access; a database error reports this rather than fabricating
an empty history. FaceTime's visible list can contain suggested people, which
are excluded. AX lists are only the currently materialized rows; the database
returns the newest N stored calls.

## Setup and limits

- macOS 26 or later with Phone configured for iPhone cellular relay, or FaceTime signed
  in; actual dialing depends on those services and the URL handler.
- Accessibility permission for the terminal/OmO host is needed for status,
  call controls, and AX recents. Contacts lookup needs Automation/Contacts
  access. SQLite history can require Full Disk Access.
- For clicks, typing, or window control that this helper doesn't cover, use the `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`); never write an ad-hoc input script or use OmO's native computer-use.
- Calls require the caller's explicit confirmation; no command should test
  `call --yes` against a real recipient. `open` opens an app, not a call.
- `0` success; `1` app-level failure or unavailable control/history;
  `2` usage, permission, or unconfirmed call. `--json` returns JSON for
  handled results and errors; argparse syntax errors use standard stderr.
