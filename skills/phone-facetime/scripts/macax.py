"""Stdlib-only bridge to macOS Accessibility (AXUIElement), CoreGraphics and CoreFoundation.

Home.app and iPhone Mirroring ship no AppleScript dictionary. System Events can
walk their Catalyst trees, but at one Apple event per attribute a tree takes
minutes, and it never sees Home's lazily built dashboard tiles. Calling
AXUIElement directly with ``AXManualAccessibility`` set is fast and exposes them.
ctypes keeps the skill free of pyobjc so it can be copied anywhere as-is.

The helper is meant for short-lived CLI processes: Core Foundation objects
returned by Copy/Create calls are intentionally not released.
"""

from __future__ import annotations

import ctypes
import subprocess
import time
from collections.abc import Iterator
from ctypes import (
    POINTER,
    Structure,
    byref,
    c_bool,
    c_double,
    c_float,
    c_int32,
    c_long,
    c_uint16,
    c_uint32,
    c_uint64,
    c_ulong,
    c_void_p,
)
from typing import Any

_CF = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
_AX = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
_CG = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")

_UTF8 = 0x08000100
_NUMBER_DOUBLE = 13
_AX_POINT = 1
_AX_SIZE = 2


class CGPoint(Structure):
    _fields_ = [("x", c_double), ("y", c_double)]


class CGSize(Structure):
    _fields_ = [("width", c_double), ("height", c_double)]


def _sig(lib, name, restype, *argtypes):
    fn = getattr(lib, name)
    fn.restype = restype
    fn.argtypes = list(argtypes)
    return fn


CFStringCreateWithCString = _sig(_CF, "CFStringCreateWithCString", c_void_p, c_void_p, ctypes.c_char_p, c_uint32)
CFGetTypeID = _sig(_CF, "CFGetTypeID", c_ulong, c_void_p)
CFStringGetLength = _sig(_CF, "CFStringGetLength", c_long, c_void_p)
CFStringGetMaximumSizeForEncoding = _sig(_CF, "CFStringGetMaximumSizeForEncoding", c_long, c_long, c_uint32)
CFStringGetCString = _sig(_CF, "CFStringGetCString", c_bool, c_void_p, ctypes.c_char_p, c_long, c_uint32)
CFArrayGetCount = _sig(_CF, "CFArrayGetCount", c_long, c_void_p)
CFArrayGetValueAtIndex = _sig(_CF, "CFArrayGetValueAtIndex", c_void_p, c_void_p, c_long)
CFNumberGetValue = _sig(_CF, "CFNumberGetValue", c_bool, c_void_p, c_long, c_void_p)
CFBooleanGetValue = _sig(_CF, "CFBooleanGetValue", c_bool, c_void_p)
CFDictionaryGetCount = _sig(_CF, "CFDictionaryGetCount", c_long, c_void_p)
CFDictionaryGetKeysAndValues = _sig(_CF, "CFDictionaryGetKeysAndValues", None, c_void_p, POINTER(c_void_p), POINTER(c_void_p))
_TYPE_IDS = {
    "string": _sig(_CF, "CFStringGetTypeID", c_ulong)(),
    "array": _sig(_CF, "CFArrayGetTypeID", c_ulong)(),
    "dict": _sig(_CF, "CFDictionaryGetTypeID", c_ulong)(),
    "number": _sig(_CF, "CFNumberGetTypeID", c_ulong)(),
    "bool": _sig(_CF, "CFBooleanGetTypeID", c_ulong)(),
}
kCFBooleanTrue = c_void_p.in_dll(_CF, "kCFBooleanTrue")

AXIsProcessTrusted = _sig(_AX, "AXIsProcessTrusted", c_bool)
AXUIElementCreateApplication = _sig(_AX, "AXUIElementCreateApplication", c_void_p, c_int32)
AXUIElementCopyAttributeValue = _sig(_AX, "AXUIElementCopyAttributeValue", c_int32, c_void_p, c_void_p, POINTER(c_void_p))
AXUIElementSetAttributeValue = _sig(_AX, "AXUIElementSetAttributeValue", c_int32, c_void_p, c_void_p, c_void_p)
AXUIElementPerformAction = _sig(_AX, "AXUIElementPerformAction", c_int32, c_void_p, c_void_p)
AXUIElementCopyActionNames = _sig(_AX, "AXUIElementCopyActionNames", c_int32, c_void_p, POINTER(c_void_p))
AXUIElementSetMessagingTimeout = _sig(_AX, "AXUIElementSetMessagingTimeout", c_int32, c_void_p, c_float)
AXValueGetType = _sig(_AX, "AXValueGetType", c_uint32, c_void_p)
AXValueGetValue = _sig(_AX, "AXValueGetValue", c_bool, c_void_p, c_uint32, c_void_p)
_TYPE_IDS["element"] = _sig(_AX, "AXUIElementGetTypeID", c_ulong)()
_TYPE_IDS["axvalue"] = _sig(_AX, "AXValueGetTypeID", c_ulong)()

CGWindowListCopyWindowInfo = _sig(_CG, "CGWindowListCopyWindowInfo", c_void_p, c_uint32, c_uint32)
CGEventCreateMouseEvent = _sig(_CG, "CGEventCreateMouseEvent", c_void_p, c_void_p, c_uint32, CGPoint, c_uint32)
CGEventCreateKeyboardEvent = _sig(_CG, "CGEventCreateKeyboardEvent", c_void_p, c_void_p, c_uint16, c_bool)
CGEventKeyboardSetUnicodeString = _sig(_CG, "CGEventKeyboardSetUnicodeString", None, c_void_p, c_ulong, POINTER(c_uint16))
CGEventSetFlags = _sig(_CG, "CGEventSetFlags", None, c_void_p, c_uint64)
CGEventCreateScrollWheelEvent2 = _sig(_CG, "CGEventCreateScrollWheelEvent2", c_void_p, c_void_p, c_uint32, c_uint32, c_int32, c_int32, c_int32)
CGEventSetLocation = _sig(_CG, "CGEventSetLocation", None, c_void_p, CGPoint)
CGEventSetIntegerValueField = _sig(_CG, "CGEventSetIntegerValueField", None, c_void_p, c_uint32, ctypes.c_int64)
CGEventPost = _sig(_CG, "CGEventPost", None, c_uint32, c_void_p)

_CFSTR_CACHE: dict[str, int] = {}


def cfstr(text: str) -> int:
    ref = _CFSTR_CACHE.get(text)
    if ref is None:
        ref = CFStringCreateWithCString(None, text.encode("utf-8"), _UTF8)
        _CFSTR_CACHE[text] = ref
    return ref


def to_py(ref: int | None) -> Any:
    if not ref:
        return None
    type_id = CFGetTypeID(ref)
    if type_id == _TYPE_IDS["string"]:
        size = CFStringGetMaximumSizeForEncoding(CFStringGetLength(ref), _UTF8) + 1
        buf = ctypes.create_string_buffer(size)
        return buf.value.decode("utf-8") if CFStringGetCString(ref, buf, size, _UTF8) else ""
    if type_id == _TYPE_IDS["number"]:
        out = c_double()
        CFNumberGetValue(ref, _NUMBER_DOUBLE, byref(out))
        return int(out.value) if out.value.is_integer() else out.value
    if type_id == _TYPE_IDS["bool"]:
        return bool(CFBooleanGetValue(ref))
    if type_id == _TYPE_IDS["array"]:
        return [to_py(CFArrayGetValueAtIndex(ref, i)) for i in range(CFArrayGetCount(ref))]
    if type_id == _TYPE_IDS["dict"]:
        count = CFDictionaryGetCount(ref)
        keys = (c_void_p * count)()
        values = (c_void_p * count)()
        CFDictionaryGetKeysAndValues(ref, keys, values)
        return {to_py(keys[i]): to_py(values[i]) for i in range(count)}
    if type_id == _TYPE_IDS["element"]:
        return Element(ref)
    if type_id == _TYPE_IDS["axvalue"]:
        kind = AXValueGetType(ref)
        if kind == _AX_POINT:
            point = CGPoint()
            AXValueGetValue(ref, kind, byref(point))
            return (point.x, point.y)
        if kind == _AX_SIZE:
            size_value = CGSize()
            AXValueGetValue(ref, kind, byref(size_value))
            return (size_value.width, size_value.height)
    return None


class Element:
    def __init__(self, ref: int) -> None:
        self.ref = ref

    def attr(self, name: str) -> Any:
        out = c_void_p()
        if AXUIElementCopyAttributeValue(self.ref, cfstr(name), byref(out)) != 0:
            return None
        return to_py(out.value)

    def set_attr(self, name: str, value_ref: Any) -> bool:
        return AXUIElementSetAttributeValue(self.ref, cfstr(name), value_ref) == 0

    def perform(self, action: str) -> bool:
        return AXUIElementPerformAction(self.ref, cfstr(action)) == 0

    def actions(self) -> list[str]:
        out = c_void_p()
        if AXUIElementCopyActionNames(self.ref, byref(out)) != 0:
            return []
        return [name for name in (to_py(out.value) or []) if isinstance(name, str)]

    @property
    def role(self) -> str:
        return self.attr("AXRole") or ""

    @property
    def description(self) -> str:
        return self.attr("AXDescription") or ""

    @property
    def identifier(self) -> str:
        return self.attr("AXIdentifier") or ""

    @property
    def title(self) -> str:
        return self.attr("AXTitle") or ""

    def children(self) -> list[Element]:
        return [child for child in (self.attr("AXChildren") or []) if isinstance(child, Element)]

    def walk(self, limit: int = 5000) -> Iterator[Element]:
        stack: list[Element] = [self]
        seen = 0
        while stack and seen < limit:
            element = stack.pop()
            seen += 1
            yield element
            stack.extend(reversed(element.children()))

    def frame(self) -> tuple[float, float, float, float] | None:
        position = self.attr("AXPosition")
        size = self.attr("AXSize")
        if not position or not size:
            return None
        return (position[0], position[1], size[0], size[1])


def trusted() -> bool:
    return bool(AXIsProcessTrusted())


def app_pid(bundle_id: str) -> int | None:
    result = subprocess.run(["/usr/bin/lsappinfo", "info", "-only", "pid", "-app", bundle_id], capture_output=True, text=True, check=False)
    text = result.stdout.strip()
    if "=" not in text:
        return None
    try:
        return int(text.split("=", 1)[1].strip())
    except ValueError:
        return None


def application(pid: int) -> Element:
    app = Element(AXUIElementCreateApplication(pid))
    AXUIElementSetMessagingTimeout(app.ref, 3.0)
    # Catalyst and SwiftUI apps build their full tree only for assistive clients that ask.
    app.set_attr("AXManualAccessibility", kCFBooleanTrue)
    return app


def launch(bundle_id: str, background: bool = True, timeout: float = 15.0) -> int | None:
    pid = app_pid(bundle_id)
    if pid is None:
        args = ["/usr/bin/open", "-b", bundle_id]
        if background:
            args.insert(1, "-g")
        subprocess.run(args, capture_output=True, check=False)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        pid = app_pid(bundle_id)
        if pid is not None and application(pid).attr("AXWindows"):
            return pid
        time.sleep(0.25)
    return app_pid(bundle_id)


def wait_for(predicate: Any, timeout: float, interval: float = 0.2) -> Any:
    deadline = time.monotonic() + timeout
    value = predicate()
    while not value and time.monotonic() < deadline:
        time.sleep(interval)
        value = predicate()
    return value


def windows(pid: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = to_py(CGWindowListCopyWindowInfo(0, 0)) or []
    return [row for row in rows if row.get("kCGWindowOwnerPID") == pid and row.get("kCGWindowLayer") == 0]


def screenshot(window_id: int, out: str) -> bool:
    result = subprocess.run(["/usr/sbin/screencapture", "-x", "-o", "-l", str(window_id), out], capture_output=True, check=False)
    return result.returncode == 0


def _post_mouse(kind: int, x: float, y: float) -> None:
    CGEventPost(0, CGEventCreateMouseEvent(None, kind, CGPoint(x, y), 0))


def click(x: float, y: float) -> None:
    _post_mouse(5, x, y)  # move first so apps that track hover see the pointer
    time.sleep(0.05)
    _post_mouse(1, x, y)
    time.sleep(0.05)
    _post_mouse(2, x, y)


_SCROLL_IS_CONTINUOUS = 88
_SCROLL_PHASE = 99
_SCROLL_POINT_DY = 96
_SCROLL_POINT_DX = 97


def scroll(x: float, y: float, dx: int, dy: int, steps: int = 20) -> None:
    # Continuous, phased (trackpad-style) events: iPhone Mirroring ignores plain wheel ticks,
    # and a mouse drag reaches the phone as a stationary long press instead of a swipe.
    _post_mouse(5, x, y)
    time.sleep(0.05)
    step_x, step_y = round(dx / steps), round(dy / steps)
    for index in range(steps):
        phase = 1 if index == 0 else 4 if index == steps - 1 else 2
        event = CGEventCreateScrollWheelEvent2(None, 0, 2, step_y, step_x, 0)
        CGEventSetLocation(event, CGPoint(x, y))
        CGEventSetIntegerValueField(event, _SCROLL_IS_CONTINUOUS, 1)
        CGEventSetIntegerValueField(event, _SCROLL_PHASE, phase)
        CGEventSetIntegerValueField(event, _SCROLL_POINT_DY, step_y)
        CGEventSetIntegerValueField(event, _SCROLL_POINT_DX, step_x)
        CGEventPost(0, event)
        time.sleep(0.012)


COMMAND = 1 << 20
SHIFT = 1 << 17


def key(keycode: int, flags: int = 0) -> None:
    for down in (True, False):
        event = CGEventCreateKeyboardEvent(None, keycode, down)
        CGEventSetFlags(event, flags)
        CGEventPost(0, event)
        time.sleep(0.02)


def type_text(text: str) -> None:
    for char in text:
        units = char.encode("utf-16-le")
        buf = (c_uint16 * (len(units) // 2)).from_buffer_copy(units)
        for down in (True, False):
            event = CGEventCreateKeyboardEvent(None, 0, down)
            CGEventKeyboardSetUnicodeString(event, len(buf), buf)
            CGEventPost(0, event)
        time.sleep(0.015)
