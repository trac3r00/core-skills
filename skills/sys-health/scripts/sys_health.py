#!/usr/bin/env python3
"""Report point-in-time disk, memory, load, and process health."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
from typing import TYPE_CHECKING, Literal, TypedDict

if TYPE_CHECKING:  # Python 3.11+ at runtime; annotations stay strings here.
    from typing import NotRequired


class DiskReport(TypedDict):
    mount: str
    total_gb: float
    used_gb: float
    used_pct: float


class MemoryReport(TypedDict):
    total_gb: float
    used_pct: float


class LoadReport(TypedDict):
    m1: float
    m5: float
    m15: float


class ProcessReport(TypedDict):
    pid: int
    cpu_pct: float
    mem_pct: float
    command: str


class HealthReport(TypedDict):
    disk: DiskReport | None
    memory: MemoryReport | None
    load: LoadReport | None
    top_processes: list[ProcessReport] | None
    zombies: int | None
    alerts: list[str]
    status: NotRequired[Literal["unavailable"]]


def _disk(path: str) -> DiskReport | None:
    try:
        stat = os.statvfs(path)
    except OSError:
        return None
    total = stat.f_blocks * stat.f_frsize
    free = stat.f_bavail * stat.f_frsize
    used = total - free
    return {
        "mount": path,
        "total_gb": round(total / 1e9, 1),
        "used_gb": round(used / 1e9, 1),
        "used_pct": round(used / total * 100, 1) if total else 0.0,
    }


def _memory() -> MemoryReport | None:
    try:
        size = subprocess.run(
            ["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, check=False,
        )
        if size.returncode:
            raise OSError
        total = int(size.stdout.strip())
        result = subprocess.run(["vm_stat"], capture_output=True, text=True, check=False)
        if result.returncode:
            raise OSError
        vm = result.stdout
        page = int(re.findall(r"page size of ([1-9]\d*) bytes", vm)[0])
        pages: dict[str, int] = {}
        for line in vm.splitlines():
            key, _, value = line.partition(":")
            if key in ("Pages free", "Pages inactive"):
                pages[key] = int(value.strip().rstrip("."))
        free = pages["Pages free"] * page
        inactive = pages["Pages inactive"] * page
        if total <= 0:
            raise ValueError
        used = total - free - inactive
        return {"total_gb": round(total / 1e9, 1), "used_pct": round(used / total * 100, 1)}
    except (OSError, ValueError, IndexError, KeyError):
        try:
            info: dict[str, int] = {}
            with open("/proc/meminfo") as stream:
                for line in stream:
                    key, _, value = line.partition(":")
                    info[key] = int(value.strip().split()[0]) * 1024
            total = info["MemTotal"]
            available = info["MemAvailable"] if "MemAvailable" in info else info["MemFree"]
            if total <= 0:
                raise ValueError
            return {"total_gb": round(total / 1e9, 1), "used_pct": round((total - available) / total * 100, 1)}
        except (KeyError, OSError, ValueError, IndexError):
            return None


def _load() -> LoadReport | None:
    try:
        result = subprocess.run(
            ["sysctl", "-n", "vm.loadavg"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            raise OSError
        output = result.stdout.strip().strip("{}")
        values = output.split()
        return {"m1": float(values[0]), "m5": float(values[1]), "m15": float(values[2])}
    except (OSError, ValueError, IndexError):
        try:
            with open("/proc/loadavg") as stream:
                values = stream.read().split()
            return {"m1": float(values[0]), "m5": float(values[1]), "m15": float(values[2])}
        except (OSError, ValueError, IndexError):
            return None


def _top_processes(count: int) -> list[ProcessReport] | None:
    try:
        result = subprocess.run(
            ["ps", "-eo", "pid,pcpu,pmem,comm", "-r"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            return None
        lines = result.stdout.splitlines()
        if not lines or lines[0].split()[0] != "PID":
            return None
        processes: list[ProcessReport] = []
        for line in lines[1 : count + 1]:
            parts = line.split(None, 3)
            processes.append({
                "pid": int(parts[0]),
                "cpu_pct": float(parts[1]),
                "mem_pct": float(parts[2]),
                "command": parts[3][:80],
            })
        return processes
    except (OSError, ValueError, IndexError):
        return None


def _zombies() -> int | None:
    try:
        result = subprocess.run(
            ["ps", "-eo", "stat"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode or not result.stdout.splitlines() or result.stdout.splitlines()[0].strip() != "STAT":
            return None
        return sum(line.strip().startswith("Z") for line in result.stdout.splitlines()[1:])
    except OSError:
        return None


def _finite_pct(value: str) -> float:
    """A threshold that can actually be compared; NaN or infinity would silently disable the check."""
    number = float(value)
    if not math.isfinite(number):
        raise argparse.ArgumentTypeError(f"threshold must be a finite number: {value}")
    return number


def _process_count(value: str) -> int:
    """A non-negative row count; a negative value would silently change slice semantics."""
    count = int(value)
    if count < 0:
        raise argparse.ArgumentTypeError(f"--top must be zero or more: {value}")
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "sys-health").splitlines()[0])
    parser.add_argument("--max-disk-pct", type=_finite_pct, default=None)
    parser.add_argument("--max-mem-pct", type=_finite_pct, default=None)
    parser.add_argument("--top", type=_process_count, default=5)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    disk = _disk("/")
    memory = _memory()
    load = _load()
    top_processes = _top_processes(args.top)
    zombies = _zombies()
    alerts: list[str] = []
    if disk is None:
        alerts.append("disk unavailable")
    elif args.max_disk_pct is not None and disk["used_pct"] > args.max_disk_pct:
        alerts.append(f"disk {disk['used_pct']}% > {args.max_disk_pct}%")
    if memory is None:
        alerts.append("memory unavailable")
    elif args.max_mem_pct is not None and memory["used_pct"] > args.max_mem_pct:
        alerts.append(f"memory {memory['used_pct']}% > {args.max_mem_pct}%")
    if load is None:
        alerts.append("load unavailable")
    if top_processes is None:
        alerts.append("processes unavailable")
    if zombies is None:
        alerts.append("zombies unavailable")
    elif zombies:
        alerts.append(f"{zombies} zombie process(es)")
    report: HealthReport = {
        "disk": disk,
        "memory": memory,
        "load": load,
        "top_processes": top_processes,
        "zombies": zombies,
        "alerts": alerts,
    }
    unavailable = any(value is None for value in (disk, memory, load, top_processes, zombies))
    if unavailable:
        report["status"] = "unavailable"

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"disk: {disk['used_pct']}% of {disk['total_gb']}GB" if disk else "disk: unavailable")
        print(f"memory: {memory['used_pct']}% of {memory['total_gb']}GB" if memory else "memory: unavailable")
        print(f"load: {load['m1']} {load['m5']} {load['m15']}" if load else "load: unavailable")
        for process in top_processes or []:
            print(f"  {process['pid']:>7} {process['cpu_pct']:>5.1f}%cpu {process['command']}")
        for alert in alerts:
            print(f"ALERT: {alert}")
    return 2 if unavailable else 1 if alerts else 0


if __name__ == "__main__":
    raise SystemExit(main())
