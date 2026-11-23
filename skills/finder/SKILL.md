---
name: finder
description: "Read and control Finder: selection, listings, reveal/open, folders, tags, Trash, eject. Use for explicit Finder tasks. Not for Office files (moffice)."
version: 1.0.3
license: MIT
when_to_use: "Use for explicit Finder tasks on macOS. Creating folders, changing tags, moving items to Trash, and ejecting volumes are real filesystem actions; run them only when the user names the action and target."
metadata:
  agentskills:
    tags: [macos, finder, files, folders, tags, trash, eject, applescript, automation]
---

# Finder

`scripts/finder.py` uses Finder's AppleScript object model and `/usr/bin/xattr`
for tags. It uses no System Events, keystrokes, or mouse clicks. Run it from this
skill's directory.

## Commands

```bash
python3 scripts/finder.py --json selection
python3 scripts/finder.py --json front                     # front Finder window
python3 scripts/finder.py --json list PATH [--limit N]     # name, kind, bytes, modified; 0 = no limit
python3 scripts/finder.py --json info PATH                 # Finder's common item properties
python3 scripts/finder.py --json tags PATH
python3 scripts/finder.py --json reveal PATH
python3 scripts/finder.py --json open PATH
python3 scripts/finder.py --json new-folder PARENT NAME
python3 scripts/finder.py --json set-tags PATH TAG...      # replaces all tags
python3 scripts/finder.py --json trash PATH --yes
python3 scripts/finder.py --json eject VOLUME --yes
```

`--json` is accepted anywhere on the command line. `tags` returns an empty list
only when attribute enumeration succeeded and the tag attribute is absent. A
failed read is reported as an error; a permission failure is not evidence that
a file has no tags.

## Boundaries and exit codes

- `new-folder`, `set-tags`, `trash` and `eject` change the filesystem. Run them
  only when the user named the action and the target. Only that path is changed.
- `trash` and `eject` exit `2` without `--yes`. Pass `--yes` only after the
  user named that path for Trash or that volume for eject.
- Done when the command exits `0`; report its JSON.
- `0` success. `1` Finder or filesystem error, always as `{"error": "..."}` on
  stdout. `2` invalid arguments, non-macOS, missing tools, denied Automation
  permission, or a missing `--yes`.
- macOS only; Python standard library, `/usr/bin/osascript` and `/usr/bin/xattr`.
- For clicks, typing, or window control this helper does not cover, use the
  `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`). Never write an ad-hoc input script or use
  OmO's native computer-use.
