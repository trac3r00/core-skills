import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "watcher_scan.py")
const NOW = 1792890000000
const MINUTE = 60_000
let root

function sessionKey(cwd) {
  return `--${cwd.replace(/^\//, "").replace(/\//g, "-")}--`
}

function putSession(cwd, id, { lastMinutes, lastText = "Working on it.", title = "", paddingBytes = 0 }) {
  const dir = join(root, "sessions", sessionKey(cwd))
  mkdirSync(dir, { recursive: true })
  const lines = [
    { type: "session", id, cwd, timestamp: new Date(NOW - 120 * MINUTE).toISOString() },
    { type: "message", timestamp: NOW - 121 * MINUTE, message: { role: "user", content: title || `Task ${id}` } },
    ...(paddingBytes
      ? [{ type: "message", timestamp: NOW - 3 * MINUTE, message: { role: "toolResult", content: [{ type: "text", text: "x".repeat(paddingBytes) }] } }]
      : []),
    { type: "message", timestamp: NOW - lastMinutes * MINUTE, message: { role: "assistant", content: [{ type: "text", text: lastText }] } },
  ]
  writeFileSync(join(dir, `${id}.jsonl`), lines.map((line) => JSON.stringify(line)).join("\n"))
}

function file(name, value) {
  const path = join(root, name)
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value))
  return path
}

function scan(extraEnv = {}) {
  const result = spawnSync("python3", [script, "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      WATCHER_SESSIONS_ROOT: join(root, "sessions"),
      WATCHER_PS_FIXTURE: join(root, "ps.txt"),
      WATCHER_CWD_FIXTURE: join(root, "cwd.json"),
      WATCHER_HERDR_JSON: join(root, "herdr.json"),
      WATCHER_RUNNERS_JSON: join(root, "runners.json"),
      WATCHER_NOW_MS: String(NOW),
      ...extraEnv,
    },
  })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

function byCwd(report, name) {
  return report.sessions.find((session) => session.cwd === `/repo/${name}`)
}

before(() => {
  root = mkdtempSync(join(tmpdir(), "watcher-scan-test-"))
  putSession("/repo/active", "s-active", { lastMinutes: 2 })
  putSession("/repo/blocked", "s-blocked", { lastMinutes: 1 })
  putSession("/repo/stalled", "s-stalled", { lastMinutes: 90 })
  putSession("/repo/failed", "s-failed", { lastMinutes: 1, lastText: "Error: 503 provider unavailable" })
  putSession("/repo/herdr", "s-herdr", { lastMinutes: 4 })
  putSession("/repo/herdr", "s-herdr-old", { lastMinutes: 90 })
  putSession("/repo/idle", "s-idle", { lastMinutes: 3 })
  putSession("/repo/orphan", "s-orphan", { lastMinutes: 60 })
  putSession("/repo/unattributed", "s-unattributed", { lastMinutes: 5 })
  putSession("/repo/large", "s-large", { lastMinutes: 2, paddingBytes: 1_200_000 })
  file("ps.txt", [
    "1001 1 00:10 /Users/x/.bun/bin/bun omo-ai/node_modules/@code-yeongyu/senpi/dist/bundle/cli.js --extension plugin",
    "1002 1 00:10 /Users/x/.bun/bin/bun omo-ai/node_modules/@code-yeongyu/senpi/dist/bundle/cli.js --extension plugin",
    "1003 1 00:10 /Users/x/.bun/bin/bun omo-ai/node_modules/@code-yeongyu/senpi/dist/bundle/cli.js --extension plugin",
    "1004 1 00:10 /Users/x/.bun/bin/bun omo-ai/node_modules/@code-yeongyu/senpi/dist/bundle/cli.js --extension plugin",
    "1005 1 00:10 /Users/x/.bun/bin/bun omo-ai/node_modules/@code-yeongyu/senpi/dist/bundle/cli.js --extension plugin",
    "1006 1 00:10 /Users/x/.bun/bin/bun omo-ai/node_modules/@code-yeongyu/senpi/dist/bundle/cli.js --extension plugin",
    "1007 1 00:10 /Users/x/.bun/bin/bun omo-ai/node_modules/@code-yeongyu/senpi/dist/bundle/cli.js --extension plugin",
    "2001 1 00:10 /usr/bin/grep senpi",
    "2002 1 00:10 bun host-supervisor.js --internal-rpc-host-supervisor",
    "2003 1 00:10 bun omo-mods.js worktree launch -- omo",
  ].join("\n"))
  file("cwd.json", {
    1001: "/repo/active",
    1002: "/repo/stalled",
    1003: "/repo/blocked",
    1004: "/repo/failed",
    1005: "/repo/herdr",
    1006: "/repo/idle",
    1007: "/repo/large",
  })
  file("herdr.json", {
    result: {
      agents: [
        { pane_id: "w1:p1", agent: "pi", agent_status: "blocked", cwd: "/repo/blocked", title: "Approve the plan" },
        { pane_id: "w1:p2", agent: "pi", agent_status: "working", cwd: "/repo/herdr", title: "Run the tests" },
        { pane_id: "w1:p3", agent: "pi", agent_status: "idle", cwd: "/repo/idle", title: "Waiting" },
      ],
    },
  })
  file("runners.json", [
    {
      runner: { name: "runner-1" },
      up: true,
      hostname: "r1",
      cores: 8,
      load1: 1,
      availMb: 8000,
      sessions: [
        { id: "r-live", cwd: "/srv/repo", title: "Remote live", last: "Running verification", lastAt: NOW - MINUTE, live: true, file: "" },
        { id: "r-saved", cwd: "/srv/old", title: "Old run", last: "Done", lastAt: NOW - 180 * MINUTE, live: false, file: "" },
      ],
    },
    {
      runner: { name: "runner-2" },
      up: false,
      error: "ssh exit 255",
      sessions: [{ id: "r-down", cwd: "/srv/repo", title: "Unreachable", last: "", lastAt: NOW - 5 * MINUTE, live: true, file: "" }],
    },
  ])
})

after(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

test("classifies live, blocked, stalled, failed, idle and orphaned host sessions", () => {
  const report = scan()
  assert.equal(byCwd(report, "active").state, "active")
  assert.equal(byCwd(report, "blocked").state, "blocked")
  assert.equal(byCwd(report, "blocked").paneId, "w1:p1")
  assert.equal(byCwd(report, "stalled").state, "stalled")
  assert.equal(byCwd(report, "failed").state, "failed")
  assert.equal(byCwd(report, "idle").state, "idle")
  assert.equal(byCwd(report, "herdr").state, "active")
  const oldWithAgent = report.sessions.find((session) => session.id === "s-herdr-old")
  assert.equal(oldWithAgent.state, "unattributed")
  assert.equal(oldWithAgent.blocker, null)
  const orphan = byCwd(report, "orphan")
  assert.equal(orphan.state, "orphaned")
  assert.equal(orphan.blocker.kind, "orphaned-transcript")
  const unattributed = byCwd(report, "unattributed")
  assert.equal(unattributed.state, "unattributed")
  assert.equal(unattributed.blocker, null)
  const large = byCwd(report, "large")
  assert.equal(large.id, "s-large")
  assert.equal(large.state, "active")
  assert.equal(byCwd(report, "blocked").blocker.critical, false)
})

test("keeps the blocked pane in the attention list even without a critical signal", () => {
  const report = scan()
  assert.deepEqual(report.herdrAttention.map((agent) => agent.paneId), ["w1:p1"])
  assert.equal(report.summary.blockedPanes, 1)
  assert.equal(report.summary.blockers, 5)
})

test("reports runner sessions and a down runner", () => {
  const report = scan()
  const live = report.sessions.find((session) => session.id === "r-live")
  const saved = report.sessions.find((session) => session.id === "r-saved")
  const down = report.sessions.find((session) => session.id === "r-down")
  assert.equal(live.state, "active")
  assert.equal(saved.state, "saved")
  assert.equal(down.state, "failed")
  assert.deepEqual(report.runners.map((runner) => [runner.name, runner.up, runner.liveSessions]), [["runner-1", true, 1], ["runner-2", false, 1]])
  assert.equal(report.summary.runnersDown, 1)
})

test("a destructive title makes the blocked approval critical exactly once", () => {
  const original = join(root, "herdr.json")
  const backup = readFileSync(original, "utf8")
  try {
    writeFileSync(join(root, "herdr-critical.json"), JSON.stringify({ result: { agents: [{ pane_id: "w1:p1", agent: "pi", agent_status: "blocked", cwd: "/repo/blocked", title: "Force push and merge the branch" }] } }))
    const critical = scan({ WATCHER_HERDR_JSON: join(root, "herdr-critical.json") })
    assert.equal(byCwd(critical, "blocked").blocker.critical, true)
    assert.equal(critical.summary.criticalApprovals, 1)
    assert.equal(scan().summary.criticalApprovals, 0)
  } finally {
    writeFileSync(original, backup)
  }
})

test("skipping an inventory is reported as a warning, not a silent pass", () => {
  const report = scan({ WATCHER_HERDR_JSON: "/nonexistent/herdr.json", WATCHER_RUNNERS_JSON: "/nonexistent/runners.json" })
  assert.ok(report.warnings.some((warning) => warning.includes("herdr fixture unreadable")))
  assert.ok(report.warnings.some((warning) => warning.includes("runner fixture unreadable")))
})

test("the human report names attention panes and every session once", () => {
  const result = spawnSync("python3", [script], {
    encoding: "utf8",
    env: { ...process.env, WATCHER_SESSIONS_ROOT: join(root, "sessions"), WATCHER_PS_FIXTURE: join(root, "ps.txt"), WATCHER_CWD_FIXTURE: join(root, "cwd.json"), WATCHER_HERDR_JSON: join(root, "herdr.json"), WATCHER_RUNNERS_JSON: join(root, "runners.json"), WATCHER_NOW_MS: String(NOW) },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /attention w1:p1 blocked blocked:/)
  const hostRows = result.stdout.split("\n").filter((line) => /^  \w+ +host /.test(line))
  assert.equal(hostRows.length, 10)
  for (const id of ["s-active", "s-blocked", "s-stalled", "s-failed", "s-herdr", "s-herdr-old", "s-idle", "s-orphan", "s-unattributed", "s-large"]) {
    assert.equal(hostRows.filter((row) => row.trim().split(/\s+/)[4] === id.slice(0, 12)).length, 1, `${id} must appear once`)
  }
  assert.match(result.stdout, /runner-2\s+DOWN \(ssh exit 255\)/)
})
