---
name: spotify
description: "Read and control the Spotify desktop app: playback, player volume, shuffle, repeat, search. Use for Spotify on this Mac. Not for TV.app (apple-tv)."
version: 1.0.4
license: MIT
when_to_use: "Use for explicit Spotify desktop app tasks on macOS. Playback and sound-volume changes act on the real app; run them only when the user asks."
metadata:
  agentskills:
    tags: [macos, spotify, music, playback, applescript, automation]
---

# Spotify

This skill drives Spotify.app through its AppleScript dictionary. It does not
change macOS system volume; `volume` changes Spotify's own player volume.

## Commands

```bash
python3 scripts/spotify.py --json status
python3 scripts/spotify.py --json play [spotify:URI]
python3 scripts/spotify.py --json pause
python3 scripts/spotify.py --json toggle
python3 scripts/spotify.py --json next
python3 scripts/spotify.py --json previous
python3 scripts/spotify.py --json seek SECONDS
python3 scripts/spotify.py --json volume [0-100]          # no value: read only
python3 scripts/spotify.py --json shuffle on|off
python3 scripts/spotify.py --json repeat on|off
python3 scripts/spotify.py --json open-search QUERY
python3 scripts/spotify.py --json open URI
```

`--json` is accepted anywhere before a `--` separator (tokens after `--` are data). Read `status` first and change playback only when asked. For clicks, typing, or window control that this helper doesn't cover, use the `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`); never write an ad-hoc input script or use OmO's native computer-use.

`status` reports player state, track name, artist, album, duration in
milliseconds, position in seconds, Spotify URI, Spotify player volume, shuffle,
and repeat. Successful mutating commands include the resulting status.

## Boundaries and exit codes

- macOS only; the helper uses Python's standard library and
  `/usr/bin/osascript`.
- Exit `0` means success. Exit `1` means Spotify rejected the operation or
  returned an app-level error, always as `{"error": "..."}` on stdout.
- Exit `2` means invalid arguments, non-macOS, missing `osascript`, or denied
  Automation permission.
- Only `play`, `toggle`, `open` and `open-search` may start Spotify. Every other command (pause, next,
  previous, seek, volume, shuffle, repeat) exits 1 with "Spotify is not running" instead of launching
  it, because a launch can resume playback on its own. `status` never launches it.
- `volume` is Spotify's own sound volume and never changes system volume. Setting it is verified by a separate read-back
  (one +1 compensation when Spotify stores the value a step low); a value Spotify cannot hold (99 reads back
  as 100) exits 1 and names the actual volume. `status` never mixes fields from two tracks: a track change
  during the read is retried once, then reported as an error.
- An already-running Spotify instance is never quit.
