#!/usr/bin/env python3
"""Read and control Apple Home (Home.app) on macOS through Accessibility.

Exit codes: 0 success, 1 app-level error, 2 usage, permission or non-macOS.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import platform
import re
import subprocess
import sys
import time
from pathlib import Path
from types import ModuleType
from typing import Any

BUNDLE = "com.apple.Home"
SUMMARY_PREFIX = "Home.Status.Category."
TILE_SUFFIX = "-TileCell"
SECURITY_STATES = {"locked", "unlocked", "locking", "unlocking", "open", "closed", "opening", "closing", "jammed", "stopped"}
SECURITY_WORDS = ("lock", "door", "garage", "gate", "security", "alarm", "window")
SWITCH_STATE = re.compile(r"^(on|off|\d{1,3}%)$", re.IGNORECASE)


class HomeError(Exception):
    def __init__(self, message: str, code: int = 1, **extra: Any) -> None:
        super().__init__(message)
        self.code = code
        self.extra = extra


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u2019", "'").replace("\u2018", "'")).strip().casefold()


def _split_tile(description: str) -> tuple[str, str]:
    name, _, state = description.rpartition(", ")
    return (name, state) if name else (description, "")


def _load_macax() -> ModuleType:
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("macax", Path(__file__).resolve().parent / "macax.py")
    if spec is None or spec.loader is None:
        raise HomeError("macax.py is missing next to apple_home.py", code=2)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Home:
    def __init__(self) -> None:
        macax = _load_macax()
        self.ax = macax
        if not macax.trusted():
            raise HomeError(
                "Accessibility access is off for this process. Enable the terminal (or OmO host app) under "
                "System Settings > Privacy & Security > Accessibility, then retry.",
                code=2,
            )
        pid = macax.launch(BUNDLE, background=True)
        if pid is None:
            raise HomeError("Home.app did not start", code=1)
        self.pid = pid
        self.app = macax.application(pid)
        if self.window() is None:
            subprocess.run(["/usr/bin/open", "-g", "-b", BUNDLE], capture_output=True, check=False)
            if not macax.wait_for(self.window, 10):
                raise HomeError("Home.app has no open window; open Home once and retry")

    def window(self) -> Any:
        for name in ("AXMainWindow", "AXFocusedWindow"):
            window = self.app.attr(name)
            if window is not None:
                return window
        windows = self.app.attr("AXWindows") or []
        return windows[0] if windows else None

    def _elements(self) -> list[Any]:
        window = self.window()
        return list(window.walk()) if window is not None else []

    def title(self) -> str:
        window = self.window()
        return window.title if window is not None else ""

    def _sidebar(self) -> dict[str, list[Any]]:
        rooms: list[Any] = []
        categories: list[Any] = []
        home_tab = None
        section = ""
        for element in self._elements():
            role, ident = element.role, element.identifier
            if role == "AXHeading":
                section = element.description
                continue
            if role != "AXStaticText":
                continue
            if ident == "Home.Tab.Home":
                home_tab = element
            elif ident.startswith(SUMMARY_PREFIX):
                categories.append(element)
            elif section == "Rooms" and ident and ident == element.description:
                rooms.append(element)
        return {"rooms": rooms, "categories": categories, "home": [home_tab] if home_tab else []}

    def rooms(self) -> list[str]:
        return [element.description for element in self._sidebar()["rooms"]]

    def categories(self) -> list[str]:
        return [element.description for element in self._sidebar()["categories"]]

    def _match(self, elements: list[Any], wanted: str, kind: str) -> Any:
        hits = [element for element in elements if _norm(element.description) == _norm(wanted)]
        if not hits:
            raise HomeError(f"no {kind} named {wanted!r}", options=[element.description for element in elements])
        return hits[0]

    def navigate(self, room: str | None = None, category: str | None = None) -> str:
        sidebar = self._sidebar()
        if room:
            target = self._match(sidebar["rooms"], room, "room")
        elif category:
            target = self._match(sidebar["categories"], category, "category")
        else:
            if not sidebar["home"]:
                raise HomeError("Home tab not found in the Home.app sidebar")
            target = sidebar["home"][0]
        label = target.description
        views = {_norm(element.description) for element in sidebar["rooms"] + sidebar["categories"]}
        previous = self._tile_ids()
        if not target.perform("AXPress"):
            raise HomeError(f"could not open {label!r} in Home.app")
        if target is (sidebar["home"] or [None])[0]:
            arrived = self.ax.wait_for(lambda: _norm(self.title()) not in views, 6)
        else:
            arrived = self.ax.wait_for(lambda: _norm(self.title()) == _norm(label), 6)
        if not arrived:
            raise HomeError(f"Home.app did not switch to {label!r} (window title is {self.title()!r})")
        self._settle(previous)
        return label

    def _settle(self, previous: tuple[str, ...]) -> None:
        # The title flips ~0.3s before the old view's tiles are torn down, so wait for the tile
        # set to move off the previous view and then hold still; revisiting a view keeps its set.
        started = time.monotonic()
        last: tuple[str, ...] | None = None
        steady = 0
        while time.monotonic() - started < 5:
            current = self._tile_ids()
            if current != previous or time.monotonic() - started > 1.5:
                steady = steady + 1 if current == last else 0
                if steady >= 2:
                    return
            last = current
            time.sleep(0.2)

    def _tile_ids(self) -> tuple[str, ...]:
        return tuple(sorted(element.identifier for element in self._tile_elements()))

    def _tile_elements(self) -> list[Any]:
        return [element for element in self._elements() if element.role == "AXButton" and element.identifier.endswith(TILE_SUFFIX)]

    def tiles(self, room: str) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        for element in self._tile_elements():
            name, state = _split_tile(element.description)
            kind = "accessory" if any(action.startswith("Name:More Controls") for action in element.actions()) else "scene"
            rows.append({"room": room, "name": name, "state": state, "kind": kind, "id": element.identifier})
        return rows

    def summary(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for element in self._elements():
            if element.role == "AXButton" and element.identifier.startswith(SUMMARY_PREFIX):
                label, state = _split_tile(element.description)
                out[label.removeprefix("Show ")] = state
        return out

    def find_tile(self, room: str, name: str, kind: str) -> Any:
        rows = [row for row in self.tiles(room) if row["kind"] == kind]
        hits = [row["id"] for row in rows if _norm(row["name"]) == _norm(name)]
        if not hits:
            raise HomeError(f"no {kind} named {name!r} in {room!r}", options=[row["name"] for row in rows])
        if len(hits) > 1:
            raise HomeError(f"{len(hits)} {kind}s named {name!r} in {room!r}; rename one in Home.app first")
        return next(element for element in self._tile_elements() if element.identifier == hits[0])


def _is_security(name: str, state: str) -> bool:
    return _norm(state) in SECURITY_STATES or any(word in _norm(name) for word in SECURITY_WORDS)


def cmd_status(home: Home, _: argparse.Namespace) -> dict[str, Any]:
    home.navigate()
    return {"home": home.title(), "summary": home.summary(), "rooms": home.rooms(), "categories": home.categories()}


def cmd_rooms(home: Home, _: argparse.Namespace) -> dict[str, Any]:
    rooms = home.rooms()
    return {"count": len(rooms), "rooms": rooms}


def _collect(home: Home, room: str | None, category: str | None = None, stay: bool = False) -> list[dict[str, str]]:
    if category:
        label = home.navigate(category=category)
        rows = home.tiles(label)
        for row in rows:
            row["room"] = ""
            row["category"] = label
    else:
        rows = []
        for target in [room] if room else home.rooms():
            rows.extend(home.tiles(home.navigate(room=target)))
    if not stay:
        home.navigate()
    for row in rows:
        row.pop("id", None)
    return rows


def cmd_list(home: Home, args: argparse.Namespace) -> dict[str, Any]:
    rows = _collect(home, args.room, args.category, args.stay)
    accessories = [row for row in rows if row.pop("kind") == "accessory"]
    return {"count": len(accessories), "accessories": accessories}


def cmd_scenes(home: Home, args: argparse.Namespace) -> dict[str, Any]:
    scenes = [{"room": row["room"], "name": row["name"]} for row in _collect(home, args.room) if row["kind"] == "scene"]
    return {"count": len(scenes), "scenes": scenes}


def cmd_run_scene(home: Home, args: argparse.Namespace) -> dict[str, Any]:
    room = home.navigate(room=args.room)
    tile = home.find_tile(room, args.name, "scene")
    if not tile.perform("AXPress"):
        raise HomeError(f"Home.app rejected the press on scene {args.name!r}")
    return {"room": room, "scene": _split_tile(tile.description)[0], "triggered": True}


def cmd_toggle(home: Home, args: argparse.Namespace) -> dict[str, Any]:
    room = home.navigate(room=args.room)
    tile = home.find_tile(room, args.name, "accessory")
    name, before = _split_tile(tile.description)
    if "no response" in _norm(before):
        raise HomeError(f"{name!r} is not responding ({before}); nothing was sent")
    if _is_security(name, before) and not args.allow_security:
        raise HomeError(
            f"{name!r} looks like a lock/door/security accessory ({before}); rerun with --allow-security only if the user explicitly asked for it",
            code=2,
        )
    if not SWITCH_STATE.match(before) and not _is_security(name, before):
        raise HomeError(f"{name!r} ({before or 'no state'}) is not an on/off accessory; use `open --room` and control it in Home.app")
    ident = tile.identifier
    if not tile.perform("AXPress"):
        raise HomeError(f"Home.app rejected the press on {name!r}")

    def changed() -> str | None:
        for element in home._tile_elements():
            if element.identifier == ident:
                state = _split_tile(element.description)[1]
                return state if state != before else None
        return None

    after = home.ax.wait_for(changed, args.timeout)
    if not after:
        raise HomeError(f"{name!r} stayed {before!r} after {args.timeout:g}s; the accessory may be unreachable", room=room)
    return {"room": room, "name": name, "before": before, "after": after}


def cmd_open(home: Home, args: argparse.Namespace) -> dict[str, Any]:
    label = home.navigate(room=args.room, category=args.category)
    subprocess.run(["/usr/bin/open", "-b", BUNDLE], capture_output=True, check=False)
    return {"opened": label, "title": home.title()}


def cmd_screenshot(home: Home, args: argparse.Namespace) -> dict[str, Any]:
    if args.room or args.category:
        home.navigate(room=args.room, category=args.category)
    windows = home.ax.windows(home.pid)
    if not windows:
        raise HomeError("no Home.app window to capture")
    out = str(Path(args.out).expanduser().resolve())
    if not home.ax.screenshot(windows[0]["kCGWindowNumber"], out):
        raise HomeError("screencapture failed; grant Screen Recording to the terminal/OmO host")
    return {"path": out, "view": home.title()}


def _print(result: dict[str, Any], as_json: bool) -> None:
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    if "accessories" in result:
        for row in result["accessories"]:
            where = row.get("room") or row.get("category", "")
            print(f"{where}: {row['name']} - {row['state']}")
        return
    if "scenes" in result:
        for row in result["scenes"]:
            print(f"{row['room']}: {row['name']}")
        return
    for key, value in result.items():
        print(f"{key}: {value}")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="apple_home.py", description=__doc__)
    root.add_argument("--json", action="store_true", help="machine-readable output")
    sub = root.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="home name, summary chips (climate, lights on, security), rooms, categories")
    sub.add_parser("rooms", help="list rooms")
    listing = sub.add_parser("list", help="accessories with their current state")
    scope = listing.add_mutually_exclusive_group()
    scope.add_argument("--room")
    scope.add_argument("--category", help="Climate, Lights, Speakers & TVs, Security, Energy")
    listing.add_argument("--stay", action="store_true", help="leave Home.app on the listed view instead of returning to Home")
    scenes = sub.add_parser("scenes", help="list scenes (they live inside rooms in Home.app)")
    scenes.add_argument("--room")
    run_scene = sub.add_parser("run-scene", help="trigger a scene")
    run_scene.add_argument("name")
    run_scene.add_argument("--room", required=True)
    toggle = sub.add_parser("toggle", help="flip an on/off accessory (lights, switches, outlets, fans)")
    toggle.add_argument("name")
    toggle.add_argument("--room", required=True)
    toggle.add_argument("--allow-security", action="store_true", help="permit locks, doors and garage doors")
    toggle.add_argument("--timeout", type=float, default=6.0)
    opener = sub.add_parser("open", help="bring Home.app forward on a room or category")
    target = opener.add_mutually_exclusive_group()
    target.add_argument("--room")
    target.add_argument("--category")
    shot = sub.add_parser("screenshot", help="capture the Home.app window")
    shot.add_argument("--out", required=True)
    shot_target = shot.add_mutually_exclusive_group()
    shot_target.add_argument("--room")
    shot_target.add_argument("--category")
    for sp in sub.choices.values():
        sp.add_argument("--json", action="store_true", default=argparse.SUPPRESS)
    return root


COMMANDS = {
    "status": cmd_status,
    "rooms": cmd_rooms,
    "list": cmd_list,
    "scenes": cmd_scenes,
    "run-scene": cmd_run_scene,
    "toggle": cmd_toggle,
    "open": cmd_open,
    "screenshot": cmd_screenshot,
}


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if platform.system() != "Darwin":
        _print({"error": "apple-home requires macOS"}, args.json)
        return 2
    try:
        result = COMMANDS[args.command](Home(), args)
    except HomeError as error:
        _print({"error": str(error), **error.extra}, args.json)
        return error.code
    _print(result, args.json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
