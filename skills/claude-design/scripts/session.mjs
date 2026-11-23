import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const contracts = {
  init: ["run brief checks", "artifact chat type"],
  status: ["run", ""],
  begin: ["run expected-revision kind prompt", ""],
  resolve: ["run expected-revision operation evidence", "artifact chat outcome"],
  check: ["run expected-revision id status evidence", ""],
  complete: ["run expected-revision", ""],
};

function requireThat(condition, code, message) {
  if (!condition) throw Object.assign(new Error(message), { code });
}

function parse(argv) {
  const [command, ...args] = argv;
  requireThat(Object.hasOwn(contracts, command ?? ""), "invalid_arguments", "Unknown command");
  const [required, optional] = contracts[command].map((s) => s.split(" ").filter(Boolean));
  const allowed = new Set([...required, ...optional]);
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].slice(2);
    requireThat(args[i].startsWith("--") && allowed.has(name) && !Object.hasOwn(flags, name)
      && Boolean(args[i + 1]) && !args[i + 1].startsWith("--"), "invalid_arguments", "Invalid or duplicate flag");
    flags[name] = args[i + 1];
  }
  requireThat(required.every((name) => Object.hasOwn(flags, name)), "invalid_arguments", "Missing required flag");
  if ("expected-revision" in flags) {
    requireThat(/^(0|[1-9]\d*)$/.test(flags["expected-revision"])
      && Number.isSafeInteger(Number(flags["expected-revision"])), "invalid_revision", "Revision must be a nonnegative safe integer");
    flags["expected-revision"] = Number(flags["expected-revision"]);
  }
  for (const name of ["artifact", "chat"]) {
    if (!(name in flags)) continue;
    const pattern = name === "artifact"
      ? /^https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9_-]+$/
      : /^https:\/\/claude\.ai\/chat\/[A-Za-z0-9_-]+$/;
    requireThat(pattern.test(flags[name]), "invalid_url", `Invalid ${name} URL`);
  }
  return { command, flags };
}

function fingerprint(path) {
  path = resolve(path);
  const fd = openSync(path, "r");
  try {
    const stat = fstatSync(fd);
    requireThat(stat.isFile() && stat.size > 0, "invalid_file", "Expected a nonempty regular file");
    return { path, sha256: createHash("sha256").update(readFileSync(fd)).digest("hex") };
  } finally {
    closeSync(fd);
  }
}

function unchanged(evidence) {
  try {
    return fingerprint(evidence.path).sha256 === evidence.sha256;
  } catch {
    return false;
  }
}

function view(state) {
  const drift = {
    brief: !unchanged(state.goal),
    checks: state.checks.filter((check) => check.evidence && !unchanged(check.evidence)).map(({ id }) => id),
  };
  const stale = drift.brief || drift.checks.length > 0;
  const ready = state.artifactUrl && state.checks.every(({ status }) => status === "pass");
  return {
    ...state,
    completed: state.completed && !stale && !state.pendingOperation,
    drift,
    resumeAction: state.pendingOperation ? "reconcile-pending" : stale ? "revalidate" : ready ? "complete" : "continue",
  };
}

function mutate(command, flags, state) {
  const revision = command === "init" ? 0 : state.revision + 1;
  let entry = { revision, command };
  if (command === "init") {
    requireThat(["docs", "slides", "design", "dashboard"].includes(flags.type ?? "design"),
      "invalid_type", "Expected docs, slides, design, or dashboard");
    const ids = flags.checks.split(",");
    requireThat(ids.every((id) => id.length > 0 && id.trim() === id) && new Set(ids).size === ids.length,
      "invalid_checks", "Check IDs must be nonempty and unique");
    state = {
      schemaVersion: 1, revision, goal: fingerprint(flags.brief),
      artifactType: flags.type ?? "design",
      artifactUrl: flags.artifact ?? null, chatUrl: flags.chat ?? null,
      pendingOperation: null,
      checks: ids.map((id) => ({ id, status: "pending", evidence: null })),
      completed: false, history: [], designRevision: 0,
    };
    entry = { ...entry, goal: state.goal, checks: ids, artifactType: state.artifactType,
      artifactUrl: state.artifactUrl, chatUrl: state.chatUrl };
  } else if (command === "begin") {
    requireThat(!state.pendingOperation, "pending_operation", "Reconcile the pending operation before new work");
    requireThat(["create", "revise", "comment", "edit", "export"].includes(flags.kind), "invalid_kind", "Unknown operation kind");
    requireThat(flags.kind === "create" ? !state.artifactUrl : Boolean(state.artifactUrl),
      "artifact_required", "Create requires no artifact; other operations require an artifact");
    const prompt = fingerprint(flags.prompt);
    const goal = fingerprint(state.goal.path);
    const operation = { id: randomUUID(), kind: flags.kind, promptPath: prompt.path, promptSha256: prompt.sha256 };
    if (flags.kind !== "export") {
      state.goal = goal;
      state.checks = state.checks.map(({ id }) => ({ id, status: "pending", evidence: null }));
      state.completed = false;
      state.designRevision++;
    }
    state.pendingOperation = operation;
    entry = { ...entry, operation, goal: state.goal, designRevision: state.designRevision };
  } else if (command === "resolve") {
    requireThat(state.pendingOperation?.id === flags.operation, "operation_mismatch", "Operation must match the pending intent");
    const outcome = flags.outcome ?? "completed";
    requireThat(["completed", "not-applied"].includes(outcome), "invalid_outcome", "Unknown outcome");
    const evidence = fingerprint(flags.evidence);
    requireThat(outcome !== "completed" || Boolean(flags.artifact ?? state.artifactUrl),
      "artifact_required", "Completed operations require an artifact URL");
    // A not-applied reconciliation records evidence but makes no artifact/chat changes.
    if (outcome === "completed") {
      requireThat(!state.artifactUrl || !flags.artifact || flags.artifact === state.artifactUrl,
        "artifact_mismatch", "A run cannot change its artifact identity; start a linked run for another artifact");
      state.artifactUrl = flags.artifact ?? state.artifactUrl;
      state.chatUrl = flags.chat ?? state.chatUrl;
    }
    entry = { ...entry, operation: state.pendingOperation, outcome, evidence,
      artifactUrl: flags.artifact ?? state.artifactUrl, chatUrl: flags.chat ?? state.chatUrl };
    state.pendingOperation = null;
  } else if (command === "check") {
    requireThat(!state.pendingOperation, "pending_operation", "Reconcile the pending operation before checking");
    const check = state.checks.find(({ id }) => id === flags.id);
    requireThat(check, "unknown_check", "Check was not planned");
    requireThat(["pass", "fail", "blocked"].includes(flags.status), "invalid_status", "Unknown check status");
    check.status = flags.status;
    check.evidence = fingerprint(flags.evidence);
    state.completed = false;
    entry = { ...entry, check: { ...check } };
  } else if (command === "complete") {
    const current = view(state);
    requireThat(!state.pendingOperation && Boolean(state.artifactUrl)
      && state.checks.every(({ status }) => status === "pass")
      && !current.drift.brief && current.drift.checks.length === 0, "incomplete", "Artifact, passing checks, and current hashes are required");
    state.completed = true;
  }
  state.revision = revision;
  state.history.push(entry);
  return state;
}

function main() {
  const { command, flags } = parse(process.argv.slice(2));
  const run = resolve(flags.run);
  const path = join(run, "session.json");
  if (command === "status") return view(JSON.parse(readFileSync(path, "utf8")));
  if (command === "init") mkdirSync(run, { recursive: true });
  const lock = join(run, ".lock");
  // Only the process that successfully creates this lock may remove it.
  const fd = openSync(lock, "wx");
  let temporary;
  try {
    let state;
    if (command === "init") {
      requireThat(!existsSync(path), "already_initialized", "Session already exists");
    } else {
      state = JSON.parse(readFileSync(path, "utf8"));
      requireThat(state.revision === flags["expected-revision"], "revision_mismatch", "Expected revision does not match");
      requireThat(Number.isSafeInteger(state.revision + 1), "invalid_revision", "Revision exhausted");
    }
    state = mutate(command, flags, state);
    temporary = join(run, `.session-${randomUUID()}.tmp`);
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx" });
    renameSync(temporary, path);
    temporary = undefined;
    return view(state);
  } finally {
    try {
      if (temporary) unlinkSync(temporary);
    } finally {
      closeSync(fd);
      unlinkSync(lock);
    }
  }
}

try {
  console.log(JSON.stringify(main()));
} catch (error) {
  console.error(JSON.stringify({ error: { code: error.code ?? "session_error", message: error.message } }));
  process.exitCode = 2;
}
