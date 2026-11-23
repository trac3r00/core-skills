#!/usr/bin/env node
// OmO Pro Review - workspace bridge.
// Serves ONE planned handoff to a ChatGPT conversation as a local MCP server, so the
// reviewer reads the scoped files on demand instead of receiving an uploaded bundle.
// It reaches ChatGPT only through OpenAI's Secure MCP Tunnel (`tunnel-client`, an
// outbound connection); this script never opens a public listener or a tunnel itself.
//
// Boundaries, by construction:
// - Only the files the plan approved, re-verified against their recorded hashes at
//   start; the server holds that snapshot and never re-reads repository paths.
// - Reading tools are annotated read-only. The two write tools never touch the
//   repository: `submit_report` publishes the pass report (exclusive create, after the
//   report contract passes), and `propose_patch` stores a reviewable diff in the
//   handoff directory. Applying a patch stays a human decision.
// - Every request needs the bearer token from a 0600 file that tunnel-client injects
//   as a header; the server binds to loopback and stops after --ttl.
import { spawnSync } from "node:child_process";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseReport, readManifestSafe, show } from "./handoff.mjs";
import { fromManifest, publishAtomically } from "./pro-engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const HANDOFF = join(here, "handoff.mjs");
const SERVER_INFO = { name: "omo-pro-review-bridge", version: "1.0.0" };
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const DEFAULT_PORT = 3747;
const MAX_BODY = 4 << 20;
const MAX_READ = 200_000;
const MAX_HITS = 200;
const INSTRUCTIONS = "OmO Pro Review bridge: read-only access to one planned code-review scope. "
  + "Call get_review_scope first, then read_file / search_text for the listed files only. "
  + "When the review is done, call submit_report once with the complete report; it is checked "
  + "against the report contract and rejected with reasons if incomplete. Suggested fixes go "
  + "through propose_patch as a unified diff; nothing is ever applied to the repository.";

class BridgeError extends Error {}

/**
 * Load the handoff as an immutable snapshot: every pass is re-verified by the Pro
 * engine's own manifest check (containment, path policy, regular file, hash), so the
 * bridge can expose exactly what `plan` approved and nothing else.
 */
export function loadScope(manifestPath, pass = 1) {
  const manifest = readManifestSafe(manifestPath);
  const passes = manifest.scope.passes.length;
  if (!Number.isInteger(pass) || pass < 1 || pass > passes) throw new BridgeError("pass must be 1.." + passes);
  const bound = fromManifest(manifestPath, pass);
  const meta = new Map(manifest.scope.passes[pass - 1].map((file) => [file.path, file]));
  const files = new Map(bound.verified.map((file) => [file.path, { ...meta.get(file.path), text: file.bytes.toString("utf8") }]));
  return {
    manifest,
    manifestPath: resolve(manifestPath),
    pass,
    files,
    brief: bound.prompt,
    report: resolve(bound.report),
    marker: (manifest.markers ?? [manifest.marker])[pass - 1].line,
    dir: join(dirname(resolve(manifestPath)), "bridge"),
  };
}

function ensurePrivateDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stats = lstatSync(dir);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new BridgeError("bridge directory must be a real directory: " + dir);
  chmodSync(dir, 0o700);
}

/** Fresh token per start: the header file tunnel-client reads with `file:` holds "Bearer <hex>". */
export function issueToken(dir) {
  ensurePrivateDir(dir);
  const token = randomBytes(32).toString("hex");
  const file = join(dir, "authorization");
  try { unlinkSync(file); } catch { /* first start */ }
  writeFileSync(file, "Bearer " + token, { flag: "wx", mode: 0o600 });
  return { token, file };
}

const text = (value) => ({ content: [{ type: "text", text: value }] });
const failure = (value) => ({ content: [{ type: "text", text: value }], isError: true });
const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

export const TOOLS = [
  {
    name: "get_review_scope",
    title: "Get review scope",
    description: "Use this first. Returns the review question, the brief with the report contract and this pass's nonce marker, and the exact list of files you may read.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: READ,
  },
  {
    name: "read_file",
    title: "Read a scoped file",
    description: "Use this to read one file from the review scope, with line numbers. Only paths listed by get_review_scope are readable; anything else is refused.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository-relative path exactly as listed by get_review_scope." },
        start_line: { type: "integer", minimum: 1, description: "First line to return (default 1)." },
        end_line: { type: "integer", minimum: 1, description: "Last line to return (default: end of file)." },
      },
      required: ["path"],
      additionalProperties: false,
    },
    annotations: READ,
  },
  {
    name: "search_text",
    title: "Search the scoped files",
    description: "Use this to find a literal string (not a regex) across the scoped files. Returns path:line matches, at most 200.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, description: "Literal text to find." },
        case_sensitive: { type: "boolean", description: "Default false." },
        path_prefix: { type: "string", description: "Only search scoped files whose path starts with this." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: READ,
  },
  {
    name: "submit_report",
    title: "Submit the review report",
    description: "Use this once, when the review is complete. Pass the COMPLETE report markdown ending with the marker line. It is checked against the report contract; when rejected, fix the listed problems and call again.",
    inputSchema: {
      type: "object",
      properties: { report: { type: "string", minLength: 1, description: "The complete report markdown." } },
      required: ["report"],
      additionalProperties: false,
    },
    annotations: WRITE,
  },
  {
    name: "propose_patch",
    title: "Propose a fix as a diff",
    description: "Use this to suggest a concrete fix. Pass a unified diff (git diff format) touching only scoped files. It is stored for the user to review; it is never applied.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", minLength: 1, description: "One line: what the patch fixes." },
        diff: { type: "string", minLength: 1, description: "Unified diff with a/ and b/ path prefixes." },
      },
      required: ["summary", "diff"],
      additionalProperties: false,
    },
    annotations: WRITE,
  },
];

function scopeView(scope) {
  const { manifest } = scope;
  return JSON.stringify({
    question: manifest.question,
    pass: scope.pass + " of " + manifest.scope.passes.length,
    marker: scope.marker,
    files: [...scope.files.values()].map(({ path, role, lines, status }) => ({ path, role, lines, status })),
    deleted: manifest.digest.deleted,
    excluded: manifest.exclusions,
    digest: { branch: manifest.digest.branch, head: manifest.digest.head },
    reportContract: manifest.contract,
    brief: scope.brief,
    note: "Files are NOT attached: read them with read_file. Return the report through submit_report, not as chat text.",
  }, null, 2);
}

function readFile(scope, { path, start_line: start = 1, end_line: end }) {
  const file = scope.files.get(path);
  if (!file) return failure("not in the review scope: " + show(path) + ". Call get_review_scope for the readable paths.");
  const lines = file.text.split("\n");
  const last = Math.min(end ?? lines.length, lines.length);
  if (start > last) return failure("start_line " + start + " is past the end (" + lines.length + " lines)");
  const width = String(last).length;
  let out = "";
  let line = start;
  for (; line <= last; line += 1) {
    const next = String(line).padStart(width, " ") + "\t" + lines[line - 1] + "\n";
    if (out.length + next.length > MAX_READ) break;
    out += next;
  }
  const tail = line <= last ? "\n[truncated at line " + (line - 1) + " of " + lines.length + "; continue with start_line " + line + "]" : "";
  return text(path + " (lines " + start + "-" + (line - 1) + " of " + lines.length + ")\n" + out + tail);
}

function searchText(scope, { query, case_sensitive: exact = false, path_prefix: prefix = "" }) {
  const needle = exact ? query : query.toLowerCase();
  const hits = [];
  for (const file of scope.files.values()) {
    if (!file.path.startsWith(prefix)) continue;
    const lines = file.text.split("\n");
    for (let index = 0; index < lines.length && hits.length < MAX_HITS; index += 1) {
      const haystack = exact ? lines[index] : lines[index].toLowerCase();
      if (haystack.includes(needle)) hits.push(file.path + ":" + (index + 1) + ": " + lines[index].slice(0, 240));
    }
  }
  return text(hits.length === 0 ? "no matches in the review scope" : hits.join("\n") + (hits.length === MAX_HITS ? "\n[stopped at " + MAX_HITS + " matches]" : ""));
}

/** Contract-check a candidate report off to the side, so a rejected one never occupies the report path. */
export function checkReport(scope, report) {
  const dir = mkdtempSync(join(os.tmpdir(), "pro-review-bridge-"));
  try {
    chmodSync(dir, 0o700);
    const candidate = join(dir, "report.md");
    writeFileSync(candidate, report, { flag: "wx", mode: 0o600 });
    const run = spawnSync(process.execPath, [HANDOFF, "verify", "--report", candidate, "--format", "json"], { encoding: "utf8" });
    let problems;
    try { problems = JSON.parse(run.stdout).problems; } catch { problems = ["the report checker failed: " + (run.stderr || "no output").trim().slice(0, 300)]; }
    if (parseReport(report).marker !== scope.marker) problems.push("marker line must be exactly: " + scope.marker);
    return problems;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function submitReport(scope, { report }) {
  let occupied = true;
  try { lstatSync(scope.report); } catch { occupied = false; }
  if (occupied) return failure("a report for this pass already exists; it is not replaced. Tell the user instead of resubmitting.");
  const problems = checkReport(scope, report);
  if (problems.length > 0) return failure("report rejected, nothing was saved. Fix and call submit_report again:\n- " + problems.join("\n- "));
  publishAtomically(Buffer.from(report, "utf8"), scope.report);
  return text("report accepted and saved for pass " + scope.pass + ". The user will verify each finding locally.");
}

/**
 * Every path a unified diff names: ---/+++ headers, `diff --git a/x b/y` lines and
 * rename/copy headers (a/ b/ prefixes stripped, /dev/null ignored), so a rename or
 * copy cannot carry a change outside the scope past the check.
 */
export function diffPaths(diff) {
  const paths = new Set();
  const add = (path) => { if (path !== "/dev/null") paths.add(path.replace(/^[ab]\//, "")); };
  for (const line of diff.split("\n")) {
    const git = /^diff --git (\S+) (\S+)/.exec(line);
    if (git) { add(git[1]); add(git[2]); continue; }
    const header = /^(?:---|\+\+\+) (\S+)/.exec(line) ?? /^(?:rename|copy) (?:from|to) (\S+)/.exec(line);
    if (header) add(header[1]);
  }
  return [...paths];
}

function proposePatch(scope, { summary, diff }) {
  const paths = diffPaths(diff);
  if (paths.length === 0) return failure("no file headers found: send a unified diff with ---/+++ lines");
  const outside = paths.filter((path) => !scope.files.has(path));
  if (outside.length > 0) return failure("the diff touches paths outside the review scope: " + outside.map(show).join(", "));
  // --check only parses and matches context; it never writes to the work tree or index.
  const check = spawnSync("git", ["apply", "--check", "-"], { cwd: scope.manifest.repo, input: diff, encoding: "utf8" });
  const proposals = join(scope.dir, "proposals");
  ensurePrivateDir(proposals);
  const name = String(readdirSync(proposals).filter((entry) => entry.endsWith(".patch")).length + 1).padStart(3, "0") + ".patch";
  const header = "# summary: " + summary.replace(/\s+/g, " ").trim() + "\n# applies cleanly: " + (check.status === 0 ? "yes" : "no") + "\n";
  writeFileSync(join(proposals, name), header + diff + (diff.endsWith("\n") ? "" : "\n"), { flag: "wx", mode: 0o600 });
  return text("patch stored for the user's review as proposals/" + name + " (not applied)"
    + (check.status === 0 ? "" : "; note: it does not apply cleanly to the current files: " + (check.stderr || "").trim().slice(0, 400)));
}

const HANDLERS = {
  get_review_scope: (scope) => text(scopeView(scope)),
  read_file: readFile,
  search_text: searchText,
  submit_report: submitReport,
  propose_patch: proposePatch,
};

function rpcError(id, code, message) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }; }

/** Handle one JSON-RPC message; returns the response object, or undefined for notifications. */
export function handleMessage(scope, message, log = () => {}) {
  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id, -32600, "invalid request");
  }
  const { id, method, params } = message;
  if (id === undefined) return undefined;
  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      return { jsonrpc: "2.0", id, result: { protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS } };
    }
    case "ping": return { jsonrpc: "2.0", id, result: {} };
    case "tools/list": return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      const handler = HANDLERS[name];
      if (!handler) return rpcError(id, -32602, "unknown tool: " + show(name));
      const problem = invalidArguments(TOOLS.find((tool) => tool.name === name).inputSchema, args);
      if (problem) return { jsonrpc: "2.0", id, result: failure(problem) };
      let result;
      try { result = handler(scope, args); } catch (error) { result = failure("tool failed: " + show(error?.message ?? String(error))); }
      log({ tool: name, path: args.path, query: args.query, ok: !result.isError });
      return { jsonrpc: "2.0", id, result };
    }
    default: return rpcError(id, -32601, "method not found: " + show(method));
  }
}

/** The small subset of JSON Schema the tools use: object, required, types, minimum, minLength, no extras. */
function invalidArguments(schema, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return "arguments must be an object";
  for (const key of schema.required ?? []) if (args[key] === undefined) return "missing argument: " + key;
  for (const [key, value] of Object.entries(args)) {
    const rule = schema.properties[key];
    if (!rule) return "unknown argument: " + show(key);
    if (rule.type === "string" && (typeof value !== "string" || value.length < (rule.minLength ?? 0))) return key + " must be a non-empty string";
    if (rule.type === "integer" && (!Number.isInteger(value) || value < (rule.minimum ?? -Infinity))) return key + " must be an integer >= " + rule.minimum;
    if (rule.type === "boolean" && typeof value !== "boolean") return key + " must be true or false";
  }
  return undefined;
}

function authorized(header, token) {
  const expected = Buffer.from("Bearer " + token);
  const given = Buffer.from(String(header ?? ""));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Stateless Streamable HTTP MCP endpoint at POST /mcp (JSON responses, no session id). */
export function createBridgeServer(scope, token) {
  ensurePrivateDir(scope.dir);
  const logFile = join(scope.dir, "access.jsonl");
  const log = (entry) => appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", { mode: 0o600 });
  return createServer((request, response) => {
    const send = (status, body, headers = {}) => {
      response.writeHead(status, { "content-type": "application/json", ...headers });
      response.end(body === undefined ? undefined : JSON.stringify(body));
    };
    if (new URL(request.url ?? "/", "http://localhost").pathname !== "/mcp") return send(404, { error: "not found" });
    if (!authorized(request.headers.authorization, token)) return send(401, { error: "unauthorized" });
    if (request.method !== "POST") return send(405, { error: "POST only" }, { allow: "POST" });
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { send(413, { error: "body too large" }); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (response.headersSent) return;
      let message;
      try { message = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return send(400, rpcError(null, -32700, "parse error")); }
      if (Array.isArray(message)) return send(400, rpcError(null, -32600, "batches are not supported"));
      const reply = handleMessage(scope, message, log);
      if (reply === undefined) return send(202);
      return send(200, reply);
    });
  });
}

/** tunnel-client profile: secrets stay as env:/file: references, never literals. */
export function tunnelProfile({ tunnelId, port = DEFAULT_PORT, authorizationFile }) {
  if (!/^tunnel_[0-9a-f]{32}$/.test(tunnelId ?? "")) throw new BridgeError("--tunnel-id must look like tunnel_ followed by 32 hex characters");
  return [
    "config_version: 1",
    "control_plane:",
    "  base_url: \"https://api.openai.com\"",
    "  tunnel_id: \"" + tunnelId + "\"",
    "  api_key: env:CONTROL_PLANE_API_KEY",
    "health:",
    "  listen_addr: \"127.0.0.1:0\"",
    "log:",
    "  level: warn",
    "  format: json",
    "mcp:",
    "  server_urls:",
    "    - channel: main",
    "      url: \"http://127.0.0.1:" + port + "/mcp\"",
    "  extra_headers:",
    "    Authorization: \"file:" + authorizationFile + "\"",
    // tunnel-client's discovery/reachability probes carry their own header set.
    "  discovery_extra_headers:",
    "    Authorization: \"file:" + authorizationFile + "\"",
    "",
  ].join("\n");
}

/** The message to paste into ChatGPT (after selecting the model and @-mentioning the plugin). */
export function chatPrompt(scope) {
  return [
    "Use only the OmO Pro Review bridge app for this task; do not browse or use other tools.",
    "1. Call get_review_scope. 2. Read every listed file with read_file (search_text helps find callers).",
    "3. Review as the brief below asks. 4. Call submit_report with the complete report; if it is rejected, fix the listed problems and submit again.",
    "Optional: send concrete fixes with propose_patch as unified diffs. Never ask to apply them.",
    "Where the brief below says the files are attached or asks for the report as reply text, the bridge replaces that: read with read_file and deliver the report only through submit_report.",
    "",
    scope.brief,
  ].join("\n");
}

function parseFlags(list) {
  const flags = {};
  for (let index = 0; index < list.length; index += 1) {
    const key = list[index];
    if (!key.startsWith("--")) throw new BridgeError("unexpected argument: " + show(key));
    const value = list[index + 1];
    if (value === undefined || value.startsWith("--")) throw new BridgeError(key + " needs a value");
    flags[key.slice(2)] = value;
    index += 1;
  }
  return flags;
}
const integer = (value, fallback, flag) => {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new BridgeError(flag + " must be a non-negative integer");
  return number;
};

function serve(flags) {
  const scope = loadScope(resolve(flags.manifest ?? ""), integer(flags.pass, 1, "--pass"));
  const port = integer(flags.port, DEFAULT_PORT, "--port");
  const ttlMinutes = integer(flags.ttl, 180, "--ttl");
  const { token, file } = issueToken(scope.dir);
  const server = createBridgeServer(scope, token);
  const stop = (reason) => {
    console.log("bridge stopped (" + reason + ")");
    server.close();
    try { unlinkSync(file); } catch { /* already gone */ }
    exit(0);
  };
  process.on("SIGINT", () => stop("interrupted"));
  process.on("SIGTERM", () => stop("terminated"));
  server.listen(port, "127.0.0.1", () => {
    const bound = server.address().port;
    console.log([
      "OmO Pro Review bridge - pass " + scope.pass + ", " + scope.files.size + " file(s), read-only",
      "endpoint : http://127.0.0.1:" + bound + "/mcp (loopback only)",
      "auth     : " + file + " (use as file: header in the tunnel-client profile)",
      "report   : " + scope.report,
      "audit    : " + join(scope.dir, "access.jsonl"),
      "stops in : " + ttlMinutes + " min",
    ].join("\n"));
  });
  setTimeout(() => stop("ttl reached"), ttlMinutes * 60_000).unref?.();
}

function main() {
  const [command, ...rest] = argv.slice(2);
  try {
    const flags = parseFlags(rest);
    if (command === "serve") return serve(flags);
    if (command === "tunnel-profile") {
      const dir = join(dirname(resolve(flags.manifest ?? "")), "bridge");
      readManifestSafe(resolve(flags.manifest ?? ""));
      process.stdout.write(tunnelProfile({ tunnelId: flags["tunnel-id"], port: integer(flags.port, DEFAULT_PORT, "--port"), authorizationFile: join(dir, "authorization") }));
      return 0;
    }
    if (command === "prompt") {
      process.stdout.write(chatPrompt(loadScope(resolve(flags.manifest ?? ""), integer(flags.pass, 1, "--pass"))) + "\n");
      return 0;
    }
    console.error([
      "usage:",
      "  bridge.mjs serve          --manifest FILE [--pass N] [--port " + DEFAULT_PORT + "] [--ttl MINUTES]",
      "  bridge.mjs tunnel-profile --manifest FILE --tunnel-id tunnel_... [--port " + DEFAULT_PORT + "]",
      "  bridge.mjs prompt         --manifest FILE [--pass N]",
    ].join("\n"));
    return 2;
  } catch (error) {
    console.error("✗ " + show(error?.message ?? String(error)));
    return 2;
  }
}

if (argv[1] && import.meta.url === pathToFileURL(resolve(argv[1])).href) {
  const code = main();
  if (typeof code === "number") exit(code);
}
