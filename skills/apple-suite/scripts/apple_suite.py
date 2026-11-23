#!/usr/bin/env python3
"""Drive common macOS apps through AppleScript and URL schemes.

Exit codes: 0 success, 1 app-level error, 2 usage or non-macOS.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote


def _osascript(script: str) -> tuple[int, str, str]:
    result = subprocess.run(
        ["/usr/bin/osascript", "-e", script],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def _escaped(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _list_result(
    app: str,
    expression: str,
    key: str,
    limit: int | None = None,
) -> dict[str, object]:
    rc, output, error = _osascript(f'tell application "{app}" to {expression}')
    if rc != 0:
        return {"error": error}
    values = [item.strip() for item in output.splitlines() if item.strip()]
    if limit is not None:
        values = values[:limit]
    return {"count": len(values), key: values}


def _notes_list(limit: int) -> dict[str, object]:
    script = f"""tell application "Notes"
set noteList to {{}}
repeat with n in notes
  try
    set end of noteList to name of n
  end try
  if (count of noteList) >= {limit} then exit repeat
end repeat
set AppleScript's text item delimiters to return
return noteList as string
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    notes = [item for item in output.splitlines() if item.strip()]
    return {"count": len(notes), "notes": notes}


def _notes_create(title: str, body: str) -> dict[str, object]:
    script = f"""tell application "Notes"
set newNote to make new note at folder "Notes"
set name of newNote to "{_escaped(title)}"
set body of newNote to "{_escaped(body).replace(chr(10), "<br>")}"
return "created"
end tell"""
    rc, _, error = _osascript(script)
    return {"status": "created", "title": title} if rc == 0 else {"error": error}


def _notes_search(query: str) -> dict[str, object]:
    script = f"""tell application "Notes"
set matches to {{}}
repeat with n in notes
  if name of n contains "{_escaped(query)}" then
    set end of matches to ((name of folder of n) & " :: " & name of n)
  end if
end repeat
set AppleScript's text item delimiters to return
return matches as string
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    notes = [item for item in output.splitlines() if item.strip()]
    return {"query": query, "count": len(notes), "notes": notes}


def _reminders_list() -> dict[str, object]:
    script = """tell application "Reminders"
set remList to {}
repeat with r in reminders
  if completed of r is false then set end of remList to name of r
end repeat
set AppleScript's text item delimiters to return
return remList as string
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    reminders = [item for item in output.splitlines() if item.strip()]
    return {"count": len(reminders), "reminders": reminders}


def _reminders_add(title: str, due: str) -> dict[str, object]:
    due_clause = f', due date:date "{_escaped(due)}"' if due else ""
    script = f"""tell application "Reminders"
make new reminder with properties {{name:"{_escaped(title)}"{due_clause}}}
return "added"
end tell"""
    rc, _, error = _osascript(script)
    return {"status": "added", "title": title} if rc == 0 else {"error": error}


def _reminders_complete(title: str) -> dict[str, object]:
    script = f"""tell application "Reminders"
set matchingReminders to (reminders whose name is "{_escaped(title)}" and completed is false)
if (count of matchingReminders) > 0 then
  set completed of item 1 of matchingReminders to true
  return "completed"
end if
return "not found"
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    return (
        {"status": "completed", "title": title}
        if output == "completed"
        else {"error": f"reminder not found: {title}"}
    )


def _mail_unread() -> dict[str, object]:
    rc, output, error = _osascript(
        'tell application "Mail" to get unread count of inbox',
    )
    if rc != 0:
        return {"error": error}
    return {"unread": int(output) if output.isdigit() else output}


def _mail_list(limit: int) -> dict[str, object]:
    script = f"""tell application "Mail"
set msgList to {{}}
repeat with m in messages of inbox
  set end of msgList to (subject of m & " :: " & sender of m & " :: " & (date received of m as string))
  if (count of msgList) >= {limit} then exit repeat
end repeat
set AppleScript's text item delimiters to return
return msgList as string
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    messages = [item for item in output.splitlines() if item.strip()]
    return {"count": len(messages), "messages": messages}


def _calendar_list() -> dict[str, object]:
    return _list_result("Calendar", "get name of every calendar", "calendars")


def _calendar_today() -> dict[str, object]:
    script = """tell application "Calendar"
set todayDate to current date
set endOfDay to todayDate + (1 * days)
set eventList to {}
repeat with c in calendars
  repeat with e in (events of c whose start date >= todayDate and start date < endOfDay)
    set end of eventList to (summary of e & " @ " & (start date of e as string))
  end repeat
end repeat
set AppleScript's text item delimiters to return
return eventList as string
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    events = [item for item in output.splitlines() if item.strip()]
    return {"count": len(events), "events": events}


def _calendar_add(title: str, date_str: str, calendar_name: str) -> dict[str, object]:
    calendar = f'calendar "{_escaped(calendar_name)}"' if calendar_name else "calendar 1"
    script = f"""tell application "Calendar"
tell {calendar}
make new event with properties {{summary:"{_escaped(title)}", start date:date "{_escaped(date_str)}", end date:date "{_escaped(date_str)}" + (1 * hours)}}
end tell
return "added"
end tell"""
    rc, _, error = _osascript(script)
    return {"status": "added", "title": title} if rc == 0 else {"error": error}


def _terminal_run(command: str) -> dict[str, object]:
    script = f"""tell application "Terminal"
activate
do script "{_escaped(command)}"
delay 2
set tabContent to contents of selected tab of front window
return tabContent
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    return {"command": command, "output": output.splitlines()[-1] if output else "", "full": output}


def _shortcuts_list() -> dict[str, object]:
    return _list_result("Shortcuts", "get name of every shortcut", "shortcuts")


def _shortcuts_run(name: str) -> dict[str, object]:
    rc, _, error = _osascript(
        f'tell application "Shortcuts" to run shortcut "{_escaped(name)}"',
    )
    return {"status": "ran", "shortcut": name} if rc == 0 else {"error": error}


def _contacts_count() -> dict[str, object]:
    rc, output, error = _osascript('tell application "Contacts" to get count of people')
    if rc != 0:
        return {"error": error}
    return {"count": int(output) if output.isdigit() else output}


def _contacts_search(query: str) -> dict[str, object]:
    script = f"""tell application "Contacts"
set matches to (every person whose name contains "{_escaped(query)}")
set names to {{}}
repeat with p in matches
  set end of names to name of p
end repeat
set AppleScript's text item delimiters to return
return names as string
end tell"""
    rc, output, error = _osascript(script)
    if rc != 0:
        return {"error": error}
    names = [item for item in output.splitlines() if item.strip()]
    return {"query": query, "count": len(names), "contacts": names}


def _photos_count() -> dict[str, object]:
    rc, output, error = _osascript('tell application "Photos" to get count of media items')
    if rc != 0:
        return {"error": error}
    return {"count": int(output) if output.isdigit() else output}


def _photos_albums() -> dict[str, object]:
    return _list_result("Photos", "get name of every album", "albums")


def _open_url(app: str, url: str) -> dict[str, object]:
    script = f'tell application "{app}" to open location "{_escaped(url)}"'
    rc, _, error = _osascript(script)
    return {"status": "opened", "url": url} if rc == 0 else {"error": error}


def _maps_open(address: str) -> dict[str, object]:
    return _open_url("Maps", f"maps://?q={quote(address)}")


def _maps_search(query: str) -> dict[str, object]:
    return _maps_open(query)


def _maps_directions(src: str, dst: str) -> dict[str, object]:
    return _open_url("Maps", f"maps://?saddr={quote(src)}&daddr={quote(dst)}")


def _appstore_search(term: str) -> dict[str, object]:
    return _open_url("App Store", f"macappstore://search?term={quote(term)}")


def _phone_open(number: str) -> dict[str, object]:
    return _open_url("FaceTime", f"tel:{quote(number)}")


NOT_SCRIPTABLE = {
    "voicememo": "Voice Memos has no public AppleScript dictionary.",
    "password": "Passwords has no AppleScript API.",
    "findmy": "Find My has no public AppleScript API.",
    "activitymonitor": "Activity Monitor has no AppleScript API for process data.",
}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=(__doc__ or "apple-suite").splitlines()[0])
    sub = parser.add_subparsers(dest="app", required=True)

    notes = sub.add_parser("notes")
    note_sub = notes.add_subparsers(dest="action", required=True)
    note_list = note_sub.add_parser("list")
    note_list.add_argument("--limit", type=int, default=20)
    note_create = note_sub.add_parser("create")
    note_create.add_argument("--title", required=True)
    note_create.add_argument("--body", required=True)
    note_search = note_sub.add_parser("search")
    note_search.add_argument("query")

    reminders = sub.add_parser("reminders")
    reminder_sub = reminders.add_subparsers(dest="action", required=True)
    reminder_sub.add_parser("list")
    reminder_add = reminder_sub.add_parser("add")
    reminder_add.add_argument("--title", required=True)
    reminder_add.add_argument("--due", default="")
    reminder_complete = reminder_sub.add_parser("complete")
    reminder_complete.add_argument("--title", required=True)

    maps = sub.add_parser("maps")
    map_sub = maps.add_subparsers(dest="action", required=True)
    map_search = map_sub.add_parser("search")
    map_search.add_argument("query")
    directions = map_sub.add_parser("directions")
    directions.add_argument("--from", dest="src", required=True)
    directions.add_argument("--to", dest="dst", required=True)
    map_open = map_sub.add_parser("open")
    map_open.add_argument("address")

    mail = sub.add_parser("mail")
    mail_sub = mail.add_subparsers(dest="action", required=True)
    mail_sub.add_parser("unread")
    mail_list = mail_sub.add_parser("list")
    mail_list.add_argument("--limit", type=int, default=20)

    calendar = sub.add_parser("calendar")
    calendar_sub = calendar.add_subparsers(dest="action", required=True)
    calendar_sub.add_parser("list")
    calendar_sub.add_parser("today")
    calendar_add = calendar_sub.add_parser("add")
    calendar_add.add_argument("--title", required=True)
    calendar_add.add_argument("--date", required=True)
    calendar_add.add_argument("--calendar", default="")

    terminal = sub.add_parser("terminal")
    terminal_sub = terminal.add_subparsers(dest="action", required=True)
    terminal_run = terminal_sub.add_parser("run")
    terminal_run.add_argument("command")

    shortcuts = sub.add_parser("shortcuts")
    shortcut_sub = shortcuts.add_subparsers(dest="action", required=True)
    shortcut_sub.add_parser("list")
    shortcut_run = shortcut_sub.add_parser("run")
    shortcut_run.add_argument("name")

    contacts = sub.add_parser("contacts")
    contact_sub = contacts.add_subparsers(dest="action", required=True)
    contact_sub.add_parser("count")
    contact_search = contact_sub.add_parser("search")
    contact_search.add_argument("query")

    photos = sub.add_parser("photos")
    photo_sub = photos.add_subparsers(dest="action", required=True)
    photo_sub.add_parser("count")
    photo_sub.add_parser("albums")

    appstore = sub.add_parser("appstore")
    appstore_sub = appstore.add_subparsers(dest="action", required=True)
    appstore_search = appstore_sub.add_parser("search")
    appstore_search.add_argument("term")

    phone = sub.add_parser("phone")
    phone_sub = phone.add_subparsers(dest="action", required=True)
    phone_open = phone_sub.add_parser("open")
    phone_open.add_argument("number")

    parser.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    if not Path("/usr/bin/osascript").exists():
        print("error: osascript not found — macOS required", file=sys.stderr)
        return 2

    args = _parser().parse_args(argv)
    result: dict[str, object]
    if args.app == "notes":
        result = (
            _notes_list(args.limit)
            if args.action == "list"
            else _notes_create(args.title, args.body)
            if args.action == "create"
            else _notes_search(args.query)
        )
    elif args.app == "reminders":
        result = (
            _reminders_list()
            if args.action == "list"
            else _reminders_add(args.title, args.due)
            if args.action == "add"
            else _reminders_complete(args.title)
        )
    elif args.app == "maps":
        result = (
            _maps_search(args.query)
            if args.action == "search"
            else _maps_directions(args.src, args.dst)
            if args.action == "directions"
            else _maps_open(args.address)
        )
    elif args.app == "mail":
        result = _mail_unread() if args.action == "unread" else _mail_list(args.limit)
    elif args.app == "calendar":
        result = (
            _calendar_list()
            if args.action == "list"
            else _calendar_today()
            if args.action == "today"
            else _calendar_add(args.title, args.date, args.calendar)
        )
    elif args.app == "terminal":
        result = _terminal_run(args.command)
    elif args.app == "shortcuts":
        result = _shortcuts_list() if args.action == "list" else _shortcuts_run(args.name)
    elif args.app == "contacts":
        result = _contacts_count() if args.action == "count" else _contacts_search(args.query)
    elif args.app == "photos":
        result = _photos_count() if args.action == "count" else _photos_albums()
    elif args.app == "appstore":
        result = _appstore_search(args.term)
    elif args.app == "phone":
        result = _phone_open(args.number)
    elif args.app in NOT_SCRIPTABLE:
        print(f"error: {NOT_SCRIPTABLE[args.app]}", file=sys.stderr)
        return 2
    else:
        print(f"error: unsupported app {args.app}", file=sys.stderr)
        return 2

    if "error" in result:
        print(f"error: {result['error']}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for key, value in result.items():
            print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
