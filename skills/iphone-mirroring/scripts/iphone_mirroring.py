#!/usr/bin/env python3
"""Drive the macOS iPhone Mirroring app: connection state, screenshots, navigation, taps, swipes and text.

Exit codes: 0 success, 1 app-level error (for example not connected), 2 usage, permission or non-macOS.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import platform
import subprocess
import sys
import time
from pathlib import Path
from types import ModuleType
from typing import Any

BUNDLE = "com.apple.ScreenContinuity"
MAIN_WINDOW = "iphone-mirroring-main"
NAV_ITEMS = {"home": "Home Screen", "app-switcher": "App Switcher", "spotlight": "Spotlight"}
KEYCODES = {"return": 36, "tab": 48, "space": 49, "delete": 51, "escape": 53, "left": 123, "right": 124, "down": 125, "up": 126}
RETRY_BUTTONS = ("Try Again", "Connect", "Resume")
STATE_TEXT = (
    ("iPhone Not Found", "not_found"),
    ("timed out", "timed_out"),
    ("Connection Paused", "paused"),
    ("Connecting to", "connecting"),
    ("iPhone in Use", "in_use"),
    ("Unlock", "needs_unlock"),
    ("Password", "needs_auth"),
    ("Touch ID", "needs_auth"),
    ("Disconnected", "disconnected"),
    ("Unable", "error"),
)


class MirrorError(Exception):
    def __init__(self, message: str, code: int = 1, **extra: Any) -> None:
        super().__init__(message)
        self.code = code
        self.extra = extra


def _load_macax() -> ModuleType:
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("macax", Path(__file__).resolve().parent / "macax.py")
    if spec is None or spec.loader is None:
        raise MirrorError("macax.py is missing next to iphone_mirroring.py", code=2)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Mirror:
    def __init__(self, launch: bool = True) -> None:
        self.ax = _load_macax()
        if not self.ax.trusted():
            raise MirrorError(
                "Accessibility access is off for this process. Enable the terminal (or OmO host app) under "
                "System Settings > Privacy & Security > Accessibility, then retry.",
                code=2,
            )
        pid = self.ax.launch(BUNDLE, background=True) if launch else self.ax.app_pid(BUNDLE)
        if pid is None:
            raise MirrorError("iPhone Mirroring is not running" if not launch else "iPhone Mirroring did not start")
        self.pid = pid
        self.app = self.ax.application(pid)

    def window(self) -> Any:
        candidates = list(self.app.attr("AXWindows") or [])
        for name in ("AXMainWindow", "AXFocusedWindow"):
            window = self.app.attr(name)
            if window is not None:
                candidates.append(window)
        for window in candidates:
            if window.identifier == MAIN_WINDOW:
                return window
        return candidates[0] if candidates else None

    def menu_item(self, menu: str, title: str) -> Any:
        bar = self.app.attr("AXMenuBar")
        for top in bar.children() if bar is not None else []:
            if top.title != menu:
                continue
            for holder in top.children():
                for item in holder.children():
                    if item.title == title:
                        return item
        return None

    def connected(self) -> bool:
        item = self.menu_item("View", "Home Screen")
        return bool(item is not None and item.attr("AXEnabled"))

    def texts(self) -> list[str]:
        window = self.window()
        if window is None:
            return []
        out: list[str] = []
        for element in window.walk(400):
            if element.role == "AXStaticText":
                value = element.attr("AXValue")
                if isinstance(value, str) and value.strip():
                    out.append(value.strip())
            elif element.role == "AXButton" and element.description:
                out.append(f"[{element.description}]")
        return out

    def status(self) -> dict[str, Any]:
        window = self.window()
        texts = self.texts()
        if self.connected():
            state = "connected"
        elif window is None:
            state = "no_window"
        else:
            joined = " ".join(texts)
            state = next((value for needle, value in STATE_TEXT if needle.casefold() in joined.casefold()), "unknown")
        device = ""
        model = ""
        for index, text in enumerate(texts):
            if text == "Connecting to" and index + 1 < len(texts):
                model = texts[index + 1]
            elif "\u201c" in text and "\u201d" in text:
                device = text.split("\u201c", 1)[1].split("\u201d", 1)[0]
        frame = window.frame() if window is not None else None
        return {
            "state": state,
            "connected": state == "connected",
            "device": device,
            "model": model,
            "message": [text for text in texts if text not in (model, "Connecting to")],
            "window": {"x": frame[0], "y": frame[1], "width": frame[2], "height": frame[3]} if frame else None,
        }

    def require_connected(self) -> dict[str, Any]:
        info = self.status()
        if not info["connected"]:
            raise MirrorError(f"iPhone is not mirrored (state: {info['state']})", status=info)
        return info

    def activate(self) -> None:
        self.app.set_attr("AXFrontmost", self.ax.kCFBooleanTrue)
        window = self.window()
        if window is not None:
            window.perform("AXRaise")
        if not self.ax.wait_for(lambda: self.app.attr("AXFrontmost"), 3):
            subprocess.run(["/usr/bin/open", "-b", BUNDLE], capture_output=True, check=False)
            self.ax.wait_for(lambda: self.app.attr("AXFrontmost"), 3)

    def press_menu(self, menu: str, title: str) -> None:
        item = self.menu_item(menu, title)
        if item is None:
            raise MirrorError(f"menu item {menu} > {title} not found")
        if not item.attr("AXEnabled"):
            raise MirrorError(f"{menu} > {title} is disabled (state: {self.status()['state']})")
        if not item.perform("AXPress"):
            raise MirrorError(f"{menu} > {title} could not be pressed")

    def point(self, x: float, y: float, normalized: bool) -> tuple[float, float]:
        frame = self.require_connected()["window"]
        if normalized:
            if not (0 <= x <= 1 and 0 <= y <= 1):
                raise MirrorError("--norm coordinates must be between 0 and 1", code=2)
            x, y = x * frame["width"], y * frame["height"]
        if not (0 <= x <= frame["width"] and 0 <= y <= frame["height"]):
            raise MirrorError(f"({x:g}, {y:g}) is outside the {frame['width']:g}x{frame['height']:g} mirrored screen", code=2)
        return frame["x"] + x, frame["y"] + y


def cmd_status(mirror: Mirror, _: argparse.Namespace) -> dict[str, Any]:
    return mirror.status()


SETTLED = {"connected", "not_found", "timed_out", "paused", "in_use", "needs_unlock", "needs_auth", "disconnected", "error"}


def _await_settled(mirror: Mirror, wait: float) -> None:
    time.sleep(0.5)
    mirror.ax.wait_for(lambda: mirror.status()["state"] in SETTLED, wait)


def cmd_open(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    subprocess.run(["/usr/bin/open", "-b", BUNDLE], capture_output=True, check=False)
    _await_settled(mirror, args.wait)
    info = mirror.status()
    if not info["connected"]:
        raise MirrorError(f"iPhone Mirroring opened but is not connected (state: {info['state']})", status=info)
    return info


def cmd_retry(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    window = mirror.window()
    buttons = [element for element in (window.walk(400) if window is not None else []) if element.role == "AXButton" and element.description in RETRY_BUTTONS]
    if not buttons:
        return {"retried": False, **mirror.status()}
    buttons[0].perform("AXPress")
    _await_settled(mirror, args.wait)
    return {"retried": True, **mirror.status()}


def cmd_screenshot(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    window = mirror.window()
    frame = window.frame() if window is not None else None
    rows = mirror.ax.windows(mirror.pid)
    if frame:
        rows.sort(key=lambda row: abs(row["kCGWindowBounds"]["X"] - frame[0]) + abs(row["kCGWindowBounds"]["Y"] - frame[1]))
    if not rows:
        raise MirrorError("no iPhone Mirroring window to capture")
    out = str(Path(args.out).expanduser().resolve())
    if not mirror.ax.screenshot(rows[0]["kCGWindowNumber"], out):
        raise MirrorError("screencapture failed; grant Screen Recording to the terminal/OmO host")
    return {"path": out, "state": mirror.status()["state"]}


def cmd_nav(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    mirror.require_connected()
    mirror.press_menu("View", NAV_ITEMS[args.command])
    return {"pressed": NAV_ITEMS[args.command]}


def cmd_launch(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    mirror.require_connected()
    mirror.press_menu("View", "Home Screen")
    time.sleep(0.6)
    mirror.press_menu("View", "Spotlight")
    time.sleep(0.8)
    mirror.activate()
    mirror.ax.type_text(args.app)
    time.sleep(0.8)
    mirror.ax.key(KEYCODES["return"])
    return {"launched": args.app, "via": "Spotlight"}


def cmd_type(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    mirror.require_connected()
    mirror.activate()
    mirror.ax.type_text(args.text)
    if args.enter:
        mirror.ax.key(KEYCODES["return"])
    return {"typed": len(args.text), "enter": args.enter}


def cmd_key(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    mirror.require_connected()
    mirror.activate()
    for _ in range(args.repeat):
        mirror.ax.key(KEYCODES[args.name])
    return {"key": args.name, "repeat": args.repeat}


def cmd_tap(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    x, y = mirror.point(args.x, args.y, args.norm)
    mirror.activate()
    mirror.ax.click(x, y)
    return {"tapped": {"x": args.x, "y": args.y, "normalized": args.norm}, "screen": {"x": x, "y": y}}


SCROLL_SIGNS = {"down": (0, -1), "up": (0, 1), "right": (-1, 0), "left": (1, 0)}


def cmd_scroll(mirror: Mirror, args: argparse.Namespace) -> dict[str, Any]:
    if args.amount <= 0:
        raise MirrorError("--amount must be positive", code=2)
    x, y = mirror.point(args.at[0], args.at[1], args.norm) if args.at else mirror.point(0.5, 0.5, True)
    sign_x, sign_y = SCROLL_SIGNS[args.direction]
    mirror.activate()
    mirror.ax.scroll(x, y, sign_x * args.amount, sign_y * args.amount)
    return {"scrolled": args.direction, "amount": args.amount}


def _print(result: dict[str, Any], as_json: bool) -> None:
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    for key, value in result.items():
        print(f"{key}: {value}")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="iphone_mirroring.py", description=__doc__)
    root.add_argument("--json", action="store_true", help="machine-readable output")
    sub = root.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="connection state, device name, on-screen message, window frame")
    opener = sub.add_parser("open", help="bring iPhone Mirroring forward and wait for a connection")
    opener.add_argument("--wait", type=float, default=20.0)
    retry = sub.add_parser("retry", help="press Try Again after 'iPhone Not Found'")
    retry.add_argument("--wait", type=float, default=20.0)
    shot = sub.add_parser("screenshot", help="capture the mirrored iPhone screen")
    shot.add_argument("--out", required=True)
    for name, item in NAV_ITEMS.items():
        sub.add_parser(name, help=f"View > {item}")
    launch = sub.add_parser("launch", help="open an iPhone app by name through Spotlight")
    launch.add_argument("app")
    typer = sub.add_parser("type", help="enter text into the focused iPhone field")
    typer.add_argument("text")
    typer.add_argument("--enter", action="store_true", help="press Return afterwards")
    key = sub.add_parser("key", help="press a key on the iPhone")
    key.add_argument("name", choices=sorted(KEYCODES))
    key.add_argument("--repeat", type=int, default=1)
    tap = sub.add_parser("tap", help="tap at x y in points from the mirrored screen's top-left")
    tap.add_argument("x", type=float)
    tap.add_argument("y", type=float)
    tap.add_argument("--norm", action="store_true", help="x and y are 0-1 fractions of the screen")
    scroll = sub.add_parser("scroll", help="scroll lists or page Home Screen/app pages (trackpad-style, never a long press)")
    scroll.add_argument("direction", choices=sorted(SCROLL_SIGNS), help="down reveals content below; right moves to the next page")
    scroll.add_argument("--amount", type=int, default=300, help="points to scroll (default 300)")
    scroll.add_argument("--at", type=float, nargs=2, metavar=("X", "Y"), help="where to scroll (default: screen center)")
    scroll.add_argument("--norm", action="store_true", help="--at is in 0-1 fractions")
    for sp in sub.choices.values():
        sp.add_argument("--json", action="store_true", default=argparse.SUPPRESS)
    return root


COMMANDS = {
    "status": cmd_status,
    "open": cmd_open,
    "retry": cmd_retry,
    "screenshot": cmd_screenshot,
    "home": cmd_nav,
    "app-switcher": cmd_nav,
    "spotlight": cmd_nav,
    "launch": cmd_launch,
    "type": cmd_type,
    "key": cmd_key,
    "tap": cmd_tap,
    "scroll": cmd_scroll,
}


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if platform.system() != "Darwin":
        _print({"error": "iphone-mirroring requires macOS"}, args.json)
        return 2
    try:
        result = COMMANDS[args.command](Mirror(), args)
    except MirrorError as error:
        _print({"error": str(error), **error.extra}, args.json)
        return error.code
    _print(result, args.json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
