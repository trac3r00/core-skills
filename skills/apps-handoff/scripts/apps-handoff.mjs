#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve as absolute } from 'node:path';
import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const filename = new RegExp(`^thread-(${uuid})-.+\\.jsonl$`, 'i');

export class HandoffError extends Error {
  constructor(code, exitCode, details = {}) {
    super(code);
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const shell = (argv) => argv.map(quote).join(' ');

async function optionalJSON(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new HandoffError('invalid_metadata', 5, { path });
  }
}

async function desktopHome(env) {
  if (env.OMO_DESKTOP_HOME) return absolute(env.OMO_DESKTOP_HOME);
  const pointer = await optionalJSON(join(homedir(), 'Library', 'Application Support',
    'omo-desktop', 'omo-data-home.json'));
  if (pointer && (typeof pointer.path !== 'string' || !isAbsolute(pointer.path))) {
    throw new HandoffError('invalid_data_home_pointer', 5);
  }
  return pointer?.path ?? join(homedir(), '.omo', 'desktop');
}

async function run(file, args) {
  try {
    return (await exec(file, args, { timeout: 15000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  } catch {
    // Child stderr can contain private session data. Do not echo it.
    throw new HandoffError('command_failed', 5, { executable: file, args: args.slice(0, 3) });
  }
}

async function liveThreads(env, execute) {
  let rows;
  try {
    rows = env.OMO_HANDOFF_THREAD_LIST
      ? JSON.parse(await readFile(env.OMO_HANDOFF_THREAD_LIST, 'utf8'))
      : JSON.parse(await execute('omo', ['thread', 'list', '--all-scope', '--json']));
  } catch {
    // Never assume an unavailable address book means a thread is safe to resume.
    throw new HandoffError('live_state_unavailable', 5);
  }
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.thread_id !== 'string')) {
    throw new HandoffError('invalid_live_state', 5);
  }
  return rows;
}

async function transcript(path) {
  const stream = createReadStream(path);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let header;
  let entryCount = 0;
  let messageCount = 0;
  let lastTimestamp = 0;
  let incompleteTail = false;
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      if (incompleteTail) throw new HandoffError('invalid_transcript', 5, { path });
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        // An active writer may not yet have finished the final JSONL record.
        incompleteTail = true;
        continue;
      }
      if (!header) {
        if (row.type !== 'session' || row.version !== 3 ||
            !new RegExp(`^${uuid}$`, 'i').test(row.id)) {
          throw new HandoffError('invalid_header', 5, { path });
        }
        header = { type: row.type, version: row.version, id: row.id,
          timestamp: row.timestamp, cwd: row.cwd };
      } else {
        entryCount++;
        if (row.type === 'message') messageCount++;
      }
      const timestamp = Date.parse(row.timestamp);
      if (Number.isFinite(timestamp)) lastTimestamp = Math.max(lastTimestamp, timestamp);
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  if (!header) throw new HandoffError('invalid_header', 5, { path });
  return { header, entryCount, messageCount, lastTimestamp, incompleteTail };
}

export async function resolveThread(prefix, { env = process.env, execute = run,
  interrupt = false, force = false } = {}) {
  if (!/^[0-9a-f][0-9a-f-]{0,35}$/i.test(prefix ?? '')) {
    throw new HandoffError('invalid_id', 2);
  }
  const home = await desktopHome(env);
  const root = join(home, 'userdata', 'omo-sessions');
  const rows = await liveThreads(env, execute);
  const files = [];
  let installs;
  try {
    installs = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw new HandoffError('desktop_unreadable', 5);
    installs = [];
  }
  // Only inspect transcript filenames in install directories, never leases or artifacts.
  for (const install of installs.filter(item => item.isDirectory())) {
    for (const file of await readdir(join(root, install.name), { withFileTypes: true })) {
      const match = file.isFile() && filename.exec(file.name);
      if (match && match[1].toLowerCase().startsWith(prefix.toLowerCase())) {
        const path = join(root, install.name, file.name);
        files.push({ id: match[1].toLowerCase(), path, mtime: (await stat(path)).mtimeMs });
      }
    }
  }
  const ids = [...new Set(files.map(file => file.id))].sort();
  if (!ids.length) throw new HandoffError('unknown_id', 3);
  if (ids.length !== 1) throw new HandoffError('ambiguous_prefix', 3, { candidates: ids });
  const id = ids[0];
  const live = rows.filter(row => row.thread_id.toLowerCase() === id && row.alive !== false);
  const terminal = live.filter(row => row.surface === 'tui' ||
    (row.endpoint_kind ?? row.endpoint?.kind) === 'tui');
  const hosts = live.filter(row => (row.endpoint_kind ?? row.endpoint?.kind) === 'rpc_host');
  const preferred = terminal.length ? terminal : hosts;
  const activePaths = [...new Set(preferred.map(row => row.sessionPath ??
    row.session_path ?? row.session_file).filter(Boolean))];
  if (activePaths.length > 1) throw new HandoffError('conflicting_live_paths', 5);
  const selected = activePaths.length
    ? files.find(file => file.path === activePaths[0])
    : files.sort((a, b) => b.mtime - a.mtime || a.path.localeCompare(b.path))[0];
  if (!selected) throw new HandoffError('live_path_not_desktop_transcript', 5);
  const data = await transcript(selected.path);
  if (data.header.id.toLowerCase() !== id) throw new HandoffError('header_id_mismatch', 5);
  const cwd = preferred.find(row => row.cwd)?.cwd ?? data.header.cwd;
  let cwdExists = false;
  if (typeof cwd === 'string' && isAbsolute(cwd)) {
    try { cwdExists = (await stat(cwd)).isDirectory(); }
    catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw new HandoffError('cwd_unreadable', 5);
      }
    }
  }
  const strategy = terminal.length ? 'already-open' : hosts.length ? 'adopt' : 'resume';
  if (live.length && !terminal.length && !hosts.length) {
    throw new HandoffError('unknown_live_endpoint', 5);
  }
  const sessionDir = dirname(selected.path);
  const goalFile = join(sessionDir, 'extensions', 'goal', `${data.header.id}.json`);
  const storedGoal = await optionalJSON(goalFile);
  if (storedGoal && (storedGoal.version !== 1 ||
      !Object.hasOwn(storedGoal, 'goal') ||
      (storedGoal.goal !== null && (typeof storedGoal.goal?.objective !== 'string' ||
        typeof storedGoal.goal?.status !== 'string')))) {
    throw new HandoffError('invalid_goal_store', 5, { path: goalFile });
  }
  const goal = storedGoal?.goal;
  const settings = await optionalJSON(join(homedir(), '.omo', 'agent', 'settings.json'));
  const argv = strategy === 'adopt'
    ? ['env', `OMO_CODING_AGENT_SESSION_DIR=${sessionDir}`,
      'omo', 'daemon', 'adopt', id, ...(interrupt ? ['--interrupt'] : []),
      ...(force ? ['--force'] : [])]
    : ['omo', '--session', selected.path, '--session-dir', sessionDir,
      '--permission-preset', 'full-access'];
  const command = strategy === 'already-open' || !cwdExists
    ? null : `cd ${quote(cwd)} && ${shell(argv)}`;
  return {
    threadId: id, desktopHome: home, sessionPath: selected.path, sessionDir,
    selection: activePaths.length ? 'live-sessionPath' : 'newest-mtime',
    header: data.header, cwd: cwd ?? null, cwdExists,
    entryCount: data.entryCount, messageCount: data.messageCount,
    incompleteTail: data.incompleteTail,
    lastActivity: new Date(Math.max(selected.mtime, data.lastTimestamp)).toISOString(),
    goalFile, goal: goal ? { objective: goal.objective, status: goal.status } : null,
    permissionPreset: strategy === 'already-open' ? null
      : strategy === 'adopt' ? (settings?.permissionPreset ?? 'full-access') : 'full-access',
    permissionSource: strategy === 'already-open' ? 'existing-terminal (not changed)'
      : strategy === 'adopt' ? 'native-settings (project settings also apply)' : 'explicit-cli-flag',
    live: live.map(row => ({
      threadId: row.thread_id, surface: row.surface ?? null,
      endpointKind: row.endpoint_kind ?? row.endpoint?.kind ?? null,
      pid: row.pid ?? null, socket: row.socket ?? row.endpoint?.socket ?? null,
      attachments: row.attachments ?? null, cwd: row.cwd ?? null,
      sessionPath: row.sessionPath ?? row.session_path ?? row.session_file ?? null,
    })),
    strategy, command,
    blocked: !cwdExists ? 'missing_cwd' : null,
    requiresForce: hosts.some(row => Number(row.attachments) > 0),
  };
}

export async function openThread(id, options = {}) {
  const { env = process.env, execute = run, dryRun = false,
    surface = env.HERDR_ENV === '1' ? 'herdr' : 'terminal' } = options;
  if (!['herdr', 'terminal', 'print'].includes(surface)) throw new HandoffError('invalid_surface', 2);
  // Re-resolve immediately before dispatch; no saved snapshot can authorize a takeover.
  const result = await resolveThread(id, { ...options, env, execute });
  const output = { ...result, surface, dryRun, dispatched: false };
  if (result.strategy === 'already-open') return output;
  if (result.blocked) throw new HandoffError(result.blocked, 4, { resolution: output });
  if (dryRun || surface === 'print') return output;
  if (result.requiresForce && !options.force) {
    throw new HandoffError('attached', 4, { resolution: output });
  }
  if (surface === 'herdr') {
    if (!env.HERDR_WORKSPACE_ID) throw new HandoffError('missing_herdr_workspace', 4, { resolution: output });
    const created = JSON.parse(await execute('herdr', ['tab', 'create', '--workspace',
      env.HERDR_WORKSPACE_ID, '--cwd', result.cwd, '--focus']));
    const pane = created?.result?.root_pane?.pane_id;
    if (!pane) throw new HandoffError('invalid_herdr_response', 5, { resolution: output });
    output.paneId = pane;
    await execute('herdr', ['pane', 'run', pane, result.command]);
  } else {
    // argv avoids AppleScript interpolation; do script without "in" creates a new window.
    await execute('osascript', ['-e', 'on run argv', '-e', 'tell application "Terminal"',
      '-e', 'do script (item 1 of argv)', '-e', 'activate', '-e', 'end tell',
      '-e', 'end run', result.command]);
  }
  return { ...output, dispatched: true };
}

export async function main(args = process.argv.slice(2)) {
  try {
    const [subcommand, id, ...flags] = args;
    if (!['resolve', 'open'].includes(subcommand) || !id || id.startsWith('--')) {
      throw new HandoffError('usage', 2);
    }
    const options = {};
    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i];
      if (subcommand === 'resolve' && flag === '--json') continue;
      if (subcommand === 'open' && flag === '--dry-run') options.dryRun = true;
      else if (subcommand === 'open' && flag === '--interrupt') options.interrupt = true;
      else if (subcommand === 'open' && flag === '--force') options.force = true;
      else if (subcommand === 'open' && flag === '--surface' && flags[i + 1]) options.surface = flags[++i];
      else throw new HandoffError('usage', 2);
    }
    const result = subcommand === 'resolve'
      ? await resolveThread(id) : await openThread(id, options);
    console.log(JSON.stringify(result, null, 2));
    return result.blocked && result.strategy !== 'already-open' ? 4 : 0;
  } catch (error) {
    const known = error instanceof HandoffError;
    console.log(JSON.stringify({ error: known ? error.code : 'io_or_surface_failure',
      ...(known ? error.details : {}) }, null, 2));
    return known ? error.exitCode : 5;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(absolute(process.argv[1])).href) {
  process.exitCode = await main();
}
