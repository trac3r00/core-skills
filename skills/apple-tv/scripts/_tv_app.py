"""TV.app player and library commands through its AppleScript dictionary."""

from __future__ import annotations

from ._tv_common import TVError, TVOptions, app_script, decoded


def app_command(args: TVOptions) -> dict[str, str | int | float | None | list[str]]:
    """Map TV dictionary verbs onto the app CLI."""
    match args.action:
        case "status":
            fields = app_script("""        set stateText to player state as text
        set volumeLevel to sound volume
        set titleText to ""
        set showText to ""
        set albumText to ""
        set durationText to ""
        set positionText to ""
        if stateText is not "stopped" then
            set t to current track
            if t is not missing value then
                set titleText to name of t
                if (show of t) is not missing value then set showText to show of t
                if (album of t) is not missing value then set albumText to album of t
                set durationText to duration of t as text
                set positionText to player position as text
            end if
        end if
        return {my b64(stateText), volumeLevel, my b64(titleText), my b64(showText), my b64(albumText), durationText, positionText}
""")
            parts = fields[0].split(", ")
            if len(parts) != 7:
                raise TVError("unexpected TV status response")
            return {
                "state": decoded(parts[0]), "volume": int(parts[1]),
                "name": decoded(parts[2]) or None, "show": decoded(parts[3]) or None,
                "album": decoded(parts[4]) or None,
                "duration": float(parts[5]) if parts[5] else None,
                "position": float(parts[6]) if parts[6] else None,
            }
        case "search":
            lines = app_script("""        set matches to search library playlist 1 for (item 1 of argv)
        set hitNames to {}
        repeat with t in matches
            set end of hitNames to my b64(name of t)
        end repeat
        set AppleScript's text item delimiters to linefeed
        return hitNames as text
""", args.query)
            names = [decoded(line) for line in lines if line]
            return {"query": args.query, "count": len(names), "items": names}
        case "play-item":
            lines = app_script("""        set matches to search library playlist 1 for (item 1 of argv) only names
        set foundTrack to missing value
        repeat with t in matches
            if (name of t) is (item 1 of argv) then
                if foundTrack is not missing value then error "multiple library items match that name"
                set foundTrack to contents of t
            end if
        end repeat
        if foundTrack is missing value then error "library item not found"
        play foundTrack
        return my b64(name of foundTrack)
""", args.name)
            return {"played": decoded(lines[0])}
        case "volume":
            lines = app_script("""        if (player state as text) is "stopped" then error "volume requires active TV playback"
        set sound volume to (item 1 of argv as integer)
        return sound volume
""", str(args.level))
            actual = int(lines[0])
            if actual != args.level:
                raise TVError(f"TV app kept volume {actual}; requested {args.level}")
            return {"volume": actual}
        case "play" | "pause" | "toggle" | "next" | "previous":
            verbs = {"play": "play", "pause": "pause", "toggle": "playpause",
                     "next": "next track", "previous": "previous track"}
            _ = app_script(f"        {verbs[args.action]}\n        return \"OK\"\n")
            return {"action": args.action, "status": "sent"}
        case unreachable:
            raise TVError(f"unknown TV app command: {unreachable}", 2)
