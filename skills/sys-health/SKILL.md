---
name: sys-health
description: "Point-in-time Mac health: disk, memory, load, top CPU, zombies. Use when a Mac looks starved or before heavy jobs. Not for process inventory (session-finder)."
version: 1.0.3
license: MIT
when_to_use: "Use when checking whether the current Mac is resource-starved or when a heavy agent workload needs a disk or memory preflight."
metadata:
  agentskills:
    tags: [sysops, monitoring, disk, memory, processes, macos]
---

# Sys Health

```bash
python3 scripts/sys_health.py
python3 scripts/sys_health.py --json --top 10
python3 scripts/sys_health.py --max-disk-pct 90 --max-mem-pct 85
```

Run it once and quote the numbers that breach a budget; it changes nothing, so it needs no confirmation. Don't kill processes from this report without the user's request.

The report includes disk use of `/`, memory, load, the top `--top` processes by
CPU (default 5), zombie count, and `alerts`. Budgets apply only when
`--max-disk-pct`/`--max-mem-pct` are passed.
Budget breaches and zombies return exit code `1`; normal health returns `0`.
Unavailable metrics return `null` in JSON with `status: "unavailable"` and
exit code `2`; the text report labels them unavailable.
The helper is read-only and uses `statvfs`, `sysctl`/`vm_stat`, `/proc`, and
`ps` without `psutil` or vendor binaries.
