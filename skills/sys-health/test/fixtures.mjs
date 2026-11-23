import { spawnSync } from "node:child_process";

const python = String.raw`
import builtins
import importlib.util
import io
import json
import os
import subprocess
import sys
from types import SimpleNamespace

fixture = json.loads(os.environ["SYS_HEALTH_FIXTURE"])
spec = importlib.util.spec_from_file_location("sys_health", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def fixture_statvfs(path):
    if fixture.get("statvfs") == "denied":
        raise PermissionError(path)
    return SimpleNamespace(f_blocks=100, f_frsize=1000000000, f_bavail=40)

module.os.statvfs = fixture_statvfs
original_open = builtins.open

def fixture_open(path, *args, **kwargs):
    if path in ("/proc/meminfo", "/proc/loadavg"):
        raise FileNotFoundError(path)
    return original_open(path, *args, **kwargs)

def fixture_run(args, **kwargs):
    key = " ".join(args)
    response = fixture.get(key, commands[key])
    if response == "denied":
        raise PermissionError(key)
    return subprocess.CompletedProcess(args, response.get("code", 0), response["stdout"], "")

commands = {
    "sysctl -n hw.memsize": {"stdout": "1638400000\n"},
    "vm_stat": {"stdout": "Mach Virtual Memory Statistics: (page size of 4096 bytes)\nPages free: 50000.\nPages inactive: 50000.\n"},
    "sysctl -n vm.loadavg": {"stdout": "{ 0.5 1.0 1.5 }\n"},
    "ps -eo pid,pcpu,pmem,comm -r": {"stdout": "PID %CPU %MEM COMM\n42 1.0 2.0 fixture\n"},
    "ps -eo stat": {"stdout": "STAT\nS\n"},
}
builtins.open = fixture_open
module.subprocess.run = fixture_run
raise SystemExit(module.main(fixture.get("argv", ["--json"])))
`;

export const cases = [
  { id: "memory-denied", input: { "sysctl -n hw.memsize": "denied" }, expected: { code: 2, field: "memory", value: null, alert: "memory unavailable", status: "unavailable" } },
  { id: "load-denied", input: { "sysctl -n vm.loadavg": "denied" }, expected: { code: 2, field: "load", value: null, alert: "load unavailable", status: "unavailable" } },
  { id: "process-denied", input: { "ps -eo pid,pcpu,pmem,comm -r": "denied" }, expected: { code: 2, field: "top_processes", value: null, alert: "processes unavailable", status: "unavailable" } },
  { id: "zombies-denied", input: { "ps -eo stat": "denied" }, expected: { code: 2, field: "zombies", value: null, alert: "zombies unavailable", status: "unavailable" } },
  { id: "memory-command-failed", input: { "sysctl -n hw.memsize": { code: 1, stdout: "1638400000\n" } }, expected: { code: 2, field: "memory", value: null, alert: "memory unavailable", status: "unavailable" } },
  { id: "vmstat-command-failed", input: { vm_stat: { code: 1, stdout: "Mach Virtual Memory Statistics: (page size of 4096 bytes)\nPages free: 50000.\nPages inactive: 50000.\n" } }, expected: { code: 2, field: "memory", value: null, alert: "memory unavailable", status: "unavailable" } },
  { id: "load-command-failed", input: { "sysctl -n vm.loadavg": { code: 1, stdout: "{ 0.5 1.0 1.5 }\n" } }, expected: { code: 2, field: "load", value: null, alert: "load unavailable", status: "unavailable" } },
  { id: "process-command-failed", input: { "ps -eo pid,pcpu,pmem,comm -r": { code: 1, stdout: "PID %CPU %MEM COMM\n42 1.0 2.0 fixture\n" } }, expected: { code: 2, field: "top_processes", value: null, alert: "processes unavailable", status: "unavailable" } },
  { id: "zombies-command-failed", input: { "ps -eo stat": { code: 1, stdout: "STAT\nS\n" } }, expected: { code: 2, field: "zombies", value: null, alert: "zombies unavailable", status: "unavailable" } },
  { id: "page-size-4096", input: { argv: ["--json", "--max-mem-pct", "70"] }, expected: { code: 1, field: "memory.used_pct", value: 75, alert: "memory 75.0% > 70.0%", status: undefined } },
  { id: "healthy-metrics", input: {}, expected: { code: 0, field: "memory.used_pct", value: 75, alert: undefined, status: undefined } },
  { id: "disk-denied", input: { statvfs: "denied" }, expected: { code: 2, field: "disk", value: null, alert: "disk unavailable", status: "unavailable" } },
  { id: "nan-threshold-rejected", input: { argv: ["--json", "--max-mem-pct", "nan"] }, expected: { usage: true } },
  { id: "negative-top-rejected", input: { argv: ["--json", "--top", "-1"] }, expected: { usage: true } },
  { id: "valid-threshold", input: { argv: ["--json", "--max-disk-pct", "50"] }, expected: { code: 1, field: "disk.used_pct", value: 60, alert: "disk 60.0% > 50.0%", status: undefined } },
];

export function runCase(script, fixture) {
  const run = spawnSync("python3", ["-B", "-c", python, script], {
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, SYS_HEALTH_FIXTURE: JSON.stringify(fixture.input) },
  });
  let report = null;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    // An uncaught baseline exception is captured as an observed failure.
  }
  return { exitCode: run.status, report, stderr: run.stderr.slice(0, 600), stdout: run.stdout.slice(0, 1000) };
}

export function gradeCase(fixture, observed) {
  if (fixture.expected.usage) return observed.exitCode === 2 && observed.report === null;
  const { code, field, value, alert, status } = fixture.expected;
  const actual = field.split(".").reduce((part, key) => part?.[key], observed.report);
  return observed.exitCode === code
    && observed.report !== null
    && actual === value
    && observed.report.status === status
    && (alert === undefined ? observed.report.alerts.length === 0 : observed.report.alerts.includes(alert));
}
