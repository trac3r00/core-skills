#!/usr/bin/env node
// OmO -> Aside Browser, with OmO as the brain. Talks to Aside's own `aside mcp` server (stdio MCP),
// whose single `repl` tool runs Playwright-style JavaScript against Aside Browser. Aside's model is
// never involved, and nothing inside Aside.app is modified.
// Requires Node 24+. No dependencies.

import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// The `omo` helpers (see repl-helpers.js) ride along with every REPL call: Aside resets the REPL
// scope when a session closes its last tab, and a guarded prelude is cheaper than detecting that.
const HELPERS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "repl-helpers.js"), "utf8")

export class AsideError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const REMEDY = {
  "no-cli": "The Aside CLI is not installed. Ask the user to open Aside > Settings > Developers and click Install under Aside CLI, then run doctor again.",
  "not-running": "Aside is not running. Ask the user to open Aside, then run doctor again.",
  "mcp-failed": "`aside mcp` did not start or has no repl tool. Run `aside --update`, then run doctor again; if it still fails, report the stderr tail.",
  "repl-failed": "The Aside REPL ran but could not reach the browser. Ask the user to check that Aside is open and signed in, then run doctor again.",
}

export function asideBin() {
  const candidates = [process.env.ASIDE_BIN, join(homedir(), ".local", "bin", "aside")].filter(Boolean)
  const found = candidates.find((path) => existsSync(path))
  if (found) return found
  try {
    return execFileSync("which", ["aside"], { encoding: "utf8" }).trim() || null
  } catch {
    return null
  }
}

function asideRunning() {
  try {
    execFileSync("pgrep", ["-x", "Aside"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/**
 * Starts one `aside mcp` process and keeps it: its REPL scope (variables, attached tabs, `page`)
 * lives as long as this connection, so keep the returned object in the eval kernel across steps.
 */
export async function connectAside({ bin = asideBin(), startTimeoutMs = 30_000, helpers = true } = {}) {
  if (!bin) throw new AsideError("no-cli", REMEDY["no-cli"])
  if (!asideRunning()) throw new AsideError("not-running", REMEDY["not-running"])
  const child = spawn(bin, ["mcp"], { stdio: ["pipe", "pipe", "pipe"] })
  const pending = new Map()
  let nextId = 0
  let stderr = ""
  let buffer = ""
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-4000)
  })
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    buffer += chunk
    for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
      const line = buffer.slice(0, end).trim()
      buffer = buffer.slice(end + 1)
      if (!line) continue
      const message = JSON.parse(line)
      const call = message.id !== undefined ? pending.get(message.id) : undefined
      if (!call) continue
      pending.delete(message.id)
      clearTimeout(call.timer)
      if (message.error) call.reject(new AsideError("mcp", `${call.method}: ${message.error.message}`))
      else call.resolve(message.result)
    }
  })
  child.on("exit", (code) => {
    for (const call of pending.values()) {
      clearTimeout(call.timer)
      call.reject(new AsideError("mcp-failed", `aside mcp exited (${code}): ${stderr.trim().split("\n").slice(-3).join(" | ")}`))
    }
    pending.clear()
  })
  let dead
  const request = (method, params, timeoutMs) =>
    new Promise((resolveCall, reject) => {
      if (dead) return reject(new AsideError("timeout", dead))
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        // One connection runs its calls one at a time, so everything sent after a stalled call would
        // queue behind it. A new connection is not blocked by the abandoned call.
        dead = `the previous call (${method}) got no answer in ${timeoutMs} ms, so this REPL session was closed (its tabs close with it); reconnect with connectAside().`
        reject(new AsideError("timeout", dead))
        close()
      }, timeoutMs)
      pending.set(id, { method, resolve: resolveCall, reject, timer })
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n")
    })
  const notify = (method, params = {}) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n")

  const close = () => {
    child.stdin.end()
    child.kill()
  }
  try {
    await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "omo-browser-aside", version: "1.0.0" } }, startTimeoutMs)
    notify("notifications/initialized")
    const { tools } = await request("tools/list", {}, startTimeoutMs)
    const repl = tools.find((tool) => tool.name === "repl")
    if (!repl) throw new AsideError("mcp-failed", `aside mcp offers no repl tool (tools: ${tools.map((t) => t.name).join(", ")})`)
    return {
      pid: child.pid,
      /** The live API reference for the REPL, straight from Aside. Read it once per task. */
      api: repl.description,
      /**
       * Runs one REPL step. Output is what the code printed with console.log; `images` are what it
       * passed to display(). With `imagesDir`, images are also written there and their paths returned.
       */
      async run(code, { title = "OmO step", timeoutMs = 130_000, imagesDir } = {}) {
        const startedAt = performance.now()
        const source = helpers ? `${HELPERS}\n${code}` : code
        const result = await request("tools/call", { name: "repl", arguments: { title, code: source } }, timeoutMs)
        const text = result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n")
        const images = result.content.filter((part) => part.type === "image").map((part) => ({ mimeType: part.mimeType, data: part.data }))
        const out = { ok: !result.isError, text, images, ms: Math.round(performance.now() - startedAt) }
        if (imagesDir && images.length) {
          mkdirSync(imagesDir, { recursive: true })
          out.imagePaths = images.map((image, index) => {
            const path = join(imagesDir, `aside-${Date.now()}-${index}.${image.mimeType.split("/")[1] ?? "png"}`)
            writeFileSync(path, Buffer.from(image.data, "base64"))
            return path
          })
        }
        return out
      },
      close,
    }
  } catch (error) {
    close()
    if (error instanceof AsideError && error.code !== "timeout") throw error
    throw new AsideError("mcp-failed", `${error.message}\n${REMEDY["mcp-failed"]}`)
  }
}

export async function doctor() {
  const bin = asideBin()
  const report = { cli: bin, version: null, asideRunning: asideRunning(), repl: false, openTabs: null }
  let state = "ready"
  if (!bin) state = "no-cli"
  else {
    report.version = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim()
    if (!report.asideRunning) state = "not-running"
    else {
      let aside
      try {
        aside = await connectAside({ bin })
        report.repl = true
        const probe = await aside.run("const __omoDoctorTabs = await listBrowserTabs(); console.log(__omoDoctorTabs.length)", { title: "Checking the connection" })
        if (!probe.ok || !/^\d+$/.test(probe.text.trim())) state = "repl-failed"
        else report.openTabs = Number(probe.text.trim())
        report.detail = probe.ok ? undefined : probe.text
      } catch (error) {
        state = error.code ?? "mcp-failed"
        report.detail = error.message
      } finally {
        aside?.close()
      }
    }
  }
  return { state, ...report, remedy: state === "ready" ? "Connected: connectAside() from the eval js kernel." : REMEDY[state] }
}

const USAGE = `aside.mjs <command>
  doctor                       connection state and the one fix, as JSON
  api                          the live REPL API reference from Aside
  run "<code>" | run -         one REPL step in a fresh session (- reads stdin); prints console.log output
      [--images-dir <dir>]     also write display() images there
For multi-step work keep one session in the eval js kernel: const aside = await connectAside()`

async function main(argv) {
  const [command, arg] = argv
  const flag = (name) => {
    const index = argv.indexOf(`--${name}`)
    return index >= 0 ? argv[index + 1] : undefined
  }
  if (command === "doctor") return console.log(JSON.stringify(await doctor(), null, 2))
  if (command !== "api" && command !== "run") return console.log(USAGE)
  const aside = await connectAside()
  try {
    if (command === "api") return console.log(aside.api)
    if (!arg) throw new AsideError("invalid", `missing code\n\n${USAGE}`)
    const code = arg === "-" ? readFileSync(0, "utf8") : arg
    const imagesDir = flag("images-dir")
    const result = await aside.run(code, { imagesDir: imagesDir && resolve(imagesDir) })
    console.log(JSON.stringify({ ok: result.ok, text: result.text, images: result.images.length, imagePaths: result.imagePaths }, null, 2))
    if (!result.ok) process.exitCode = 1
  } finally {
    aside.close()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(JSON.stringify({ error: { code: error.code ?? "error", message: error.message } }, null, 2))
    process.exitCode = 2
  })
}
