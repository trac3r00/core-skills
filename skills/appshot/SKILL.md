---
name: appshot
description: "Capture a macOS window, screen, or region as a PNG with screencapture. Use for visual evidence or desktop state. Not for UI judgment (visual-qa)."
version: 1.0.5
license: MIT
when_to_use: "Use when a macOS screenshot is needed for evidence or visual inspection. Treat full-screen and app captures as potentially private; capture only the requested surface."
metadata:
  agentskills:
    tags: [screenshot, macos, capture, visual-qa, evidence]
---

# AppShot

`scripts/appshot.py` captures macOS windows with the built-in `screencapture`; no dependencies.

```bash
python3 scripts/appshot.py --list [--json]                  # apps with capturable windows
python3 scripts/appshot.py --screen --out /tmp/<task>/screen.png
python3 scripts/appshot.py --app "Google Chrome" --out /tmp/<task>/chrome.png
python3 scripts/appshot.py --region --out /tmp/<task>/region.png   # user drags a region
python3 scripts/appshot.py --screen --out -                 # base64 PNG on stdout
```

1. Run `--list` first when the target window is unknown. Apps whose windows
   cannot be counted appear under `skipped` (JSON) or as stderr warnings (text);
   they are not hidden. `--list` exits `1` when no window is capturable.
2. Capture only the surface the user asked for; screens can show private data.
   `--app` brings that app to the front through System Events, which may need
   Accessibility/Automation permission.
3. Done when the helper exits `0` and prints `captured: PATH (N bytes)` (or
   `{"captured", "bytes"}` with `--json`). Open the image and look at it before describing it.
4. Write captures to a task-owned scratch directory and delete them when the
   task ends, unless the user wants them kept.

Exit codes: `0` captured, `1` nothing captured (no window, activation or capture
failure), `2` usage error or non-macOS. For clicks, typing, or window control
this helper does not cover, use the `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`). Never
write an ad-hoc input script or use OmO's native computer-use.
