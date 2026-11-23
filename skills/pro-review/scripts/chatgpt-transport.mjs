#!/usr/bin/env node
// OmO Pro Review - own ChatGPT browser transport. Zero dependencies, Node.js 24+.
// Drives a dedicated-profile Chrome over the DevTools protocol (built-in WebSocket).
// The Chrome launch flags and the ChatGPT page flow are adapted from steipete/oracle
// (MIT License, Copyright (c) 2026 Peter Steinberger); everything here is our own code.
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CHATGPT_URL = "https://chatgpt.com/";

const runText = (command, args) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000 });

/** A macOS app bundle's executable when it is Chromium-based (it ships "<Name> Framework.framework"), else undefined. */
export function macChromiumExecutable(app, run = runText) {
  let frameworks;
  try { frameworks = readdirSync(join(app, "Contents/Frameworks")); } catch { return undefined; }
  if (!frameworks.some((name) => name.endsWith(" Framework.framework"))) return undefined;
  const executable = run("plutil", ["-extract", "CFBundleExecutable", "raw", join(app, "Contents/Info.plist")]).trim();
  return executable ? join(app, "Contents/MacOS", executable) : undefined;
}

/** The https handler's bundle id from LaunchServices; macOS falls back to Safari when none is recorded. */
export function macDefaultBundleId(run = runText, home = os.homedir()) {
  const plist = join(home, "Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist");
  if (!existsSync(plist)) return "com.apple.safari";
  const handlers = JSON.parse(run("plutil", ["-extract", "LSHandlers", "json", "-o", "-", plist]));
  return String(handlers.find((entry) => entry.LSHandlerURLScheme === "https")?.LSHandlerRoleAll ?? "com.apple.safari").toLowerCase();
}

function macAppForBundleId(id, run, home) {
  // LaunchServices stores ids lowercased ("com.brave.browser"); match case-insensitively.
  let found = [];
  try { found = run("mdfind", ["kMDItemCFBundleIdentifier == '" + id.replace(/'/g, "") + "'c"]).split("\n").filter((path) => path.endsWith(".app")); } catch { /* Spotlight off */ }
  if (found.length) return found.find((path) => path.startsWith("/Applications/")) ?? found[0];
  for (const dir of ["/Applications", join(home, "Applications")]) {
    let names = [];
    try { names = readdirSync(dir).filter((name) => name.endsWith(".app")); } catch { continue; }
    for (const name of names) {
      try {
        if (run("plutil", ["-extract", "CFBundleIdentifier", "raw", join(dir, name, "Contents/Info.plist")]).trim().toLowerCase() === id) return join(dir, name);
      } catch { /* not a readable bundle */ }
    }
  }
  return undefined;
}

const WINDOWS_PROG_IDS = { chromehtml: "Google\\Chrome\\Application\\chrome.exe", bravehtml: "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  msedgehtm: "Microsoft\\Edge\\Application\\msedge.exe", vivaldihtm: "Vivaldi\\Application\\vivaldi.exe", chromiumhtm: "Chromium\\Application\\chrome.exe" };
const LINUX_CHROMIUM = /chrom|brave|edge|vivaldi|opera|helium/i;

/**
 * The user's default browser when it is Chromium-based (the transport speaks the DevTools
 * protocol). Returns { path, name } or throws naming the browser that cannot be driven;
 * returns undefined only when no default can be determined at all.
 */
export function defaultBrowser({ env = process.env, platform = process.platform, run = runText, home = os.homedir() } = {}) {
  const unsupported = (name) => new Error("pro-review transport: the default browser (" + name + ") is not Chromium-based, so it cannot be driven over the DevTools protocol. " +
    "Make a Chromium browser (Chrome, Brave, Edge, ...) the default, or set PRO_REVIEW_BROWSER to its executable. Nothing was sent.");
  if (platform === "darwin") {
    let id;
    try { id = macDefaultBundleId(run, home); } catch { return undefined; }
    const app = macAppForBundleId(id, run, home);
    const path = app && macChromiumExecutable(app, run);
    if (!path) throw unsupported(app ? basename(app, ".app") : id);
    return { path, name: basename(app, ".app") };
  }
  if (platform === "win32") {
    let progId;
    try { progId = /ProgId\s+REG_SZ\s+(\S+)/i.exec(run("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice", "/v", "ProgId"]))?.[1]; } catch { return undefined; }
    if (!progId) return undefined;
    const relative = WINDOWS_PROG_IDS[progId.toLowerCase().replace(/[.-].*$/, "")];
    if (!relative) throw unsupported(progId);
    const path = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean).map((root) => join(root, relative)).find((candidate) => existsSync(candidate));
    if (!path) throw unsupported(progId + " (executable not found)");
    return { path, name: basename(path, ".exe") };
  }
  let desktop;
  try { desktop = run("xdg-settings", ["get", "default-web-browser"]).trim(); } catch { return undefined; }
  if (!desktop) return undefined;
  const name = desktop.replace(/\.desktop$/, "");
  if (!LINUX_CHROMIUM.test(name)) throw unsupported(name);
  for (const candidate of [name, name.replace(/-stable$/, ""), name.replace(/^.*\./, "").toLowerCase()]) {
    try { const path = run("which", [candidate]).trim(); if (path) return { path, name }; } catch { /* try the next spelling */ }
  }
  throw unsupported(name + " (executable not found)");
}

/**
 * The browser binary: PRO_REVIEW_BROWSER (or the older PRO_REVIEW_CHROME), absolute;
 * else the user's default browser; else, only when no default can be determined, a
 * standard Chrome install.
 */
export function chromePath(env = process.env, platform = process.platform, detect = defaultBrowser) {
  const override = env.PRO_REVIEW_BROWSER || env.PRO_REVIEW_CHROME;
  if (override) {
    if (!isAbsolute(override)) throw new Error("pro-review transport: PRO_REVIEW_BROWSER must be an absolute path");
    return override;
  }
  const chosen = detect({ env, platform });
  if (chosen) return chosen.path;
  const candidates = platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome")]
    : platform === "win32"
      ? [join(env.PROGRAMFILES ?? "C:\\Program Files", "Google\\Chrome\\Application\\chrome.exe"), join(env.LOCALAPPDATA ?? "", "Google\\Chrome\\Application\\chrome.exe")]
      : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("pro-review transport: no default browser could be determined and Google Chrome is not installed; set PRO_REVIEW_BROWSER");
  return found;
}

// A profile's cookies are encrypted with whichever key store the Chrome that wrote them
// used. Launching with the other one makes Chrome discard every cookie it cannot
// decrypt, which signs the profile out. Oracle's rule, kept verbatim for profiles it
// created: macOS profiles carrying the marker, or brand-new ones, use the real Keychain;
// every existing unmarked profile keeps the mock Keychain.
export const NATIVE_KEYCHAIN_MARKERS = [".pro-review-native-keychain-v1", ".oracle-native-keychain-v1"];
export function usesNativeKeychain(profile, platform = process.platform) {
  if (platform !== "darwin") return false;
  if (NATIVE_KEYCHAIN_MARKERS.some((name) => existsSync(join(profile, name)))) return true;
  return !existsSync(join(profile, "Local State"));
}

/**
 * Launch flags; `nativeKeychain` must come from usesNativeKeychain for this profile.
 * `signIn` drops the DevTools port: Google's sign-in refuses a browser that exposes
 * remote debugging ("This browser or app may not be secure"), so the one-time human
 * sign-in runs in a plain Chrome on the same profile and key store.
 */
export function chromeFlags({ profile, hidden, nativeKeychain, signIn = false, platform = process.platform }) {
  const keychain = platform !== "win32" && !nativeKeychain ? ["--password-store=basic", "--use-mock-keychain"] : [];
  if (signIn) return [...keychain, "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--lang=en-US"];
  return [
    ...keychain,
    "--user-data-dir=" + profile,
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-client-side-phishing-detection",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--disable-ipc-flooding-protection",
    "--disable-hang-monitor",
    "--disable-prompt-on-repost",
    "--disable-domain-reliability",
    "--disable-popup-blocking",
    "--disable-breakpad",
    "--disable-features=Translate,TranslateUI,AutomationControlled,OptimizationHints,MediaRouter,DialMediaRouteProvider,CalculateNativeWinOcclusion",
    "--window-size=1280,900",
    "--lang=en-US",
    "--accept-lang=en-US,en",
    // A background run is headless: no window, no Dock icon, nothing macOS can bring to
    // the front or use to switch Spaces. The page still renders and takes trusted input.
    // --no-startup-window: no restored session (Brave restores the last tabs even
    // headless, and a restored ChatGPT tab would keep the browser alive) and no new-tab
    // page; every run opens its own tab over DevTools.
    ...(hidden ? ["--headless=new", "--no-startup-window"] : []),
  ];
}

/** "<host>-<pid>" from the profile's SingletonLock when a live Chrome holds it on this host. */
export function profileHolder(profile) {
  let target;
  try { target = readlinkSync(join(profile, "SingletonLock")); } catch { return undefined; }
  const match = /^(.*)-(\d+)$/.exec(target);
  if (!match || match[1] !== os.hostname()) return undefined;
  const pid = Number(match[2]);
  try { process.kill(pid, 0); return pid; } catch (error) { return error?.code === "EPERM" ? pid : undefined; }
}

function readActivePort(profile) {
  try {
    const [port, path] = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n");
    return /^\d+$/.test(port) && path?.startsWith("/devtools/browser/") ? { port: Number(port), path } : undefined;
  } catch { return undefined; }
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/** Poll `probe` until it returns a value or the deadline passes; rejects with `what` on timeout. */
export async function until(probe, { timeoutMs, intervalMs = 250, what }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined && value !== null && value !== false) return value;
    if (Date.now() >= deadline) throw new Error("pro-review transport: timed out after " + Math.round(timeoutMs / 1000) + "s waiting for " + what);
    await pause(intervalMs);
  }
}

async function endpointAlive({ port, path }) {
  try {
    const response = await fetch("http://127.0.0.1:" + port + "/json/version", { signal: AbortSignal.timeout(2000) });
    const info = await response.json();
    return typeof info.webSocketDebuggerUrl === "string" && info.webSocketDebuggerUrl.endsWith(path);
  } catch { return false; }
}

/**
 * Reuse the Chrome already holding the profile (one we launched earlier, perhaps kept
 * open for a sign-in: never killed) or launch a new one. Chrome is detached so a
 * dying CLI never takes the conversation with it.
 */
export async function obtainChrome({ profile, hidden, env = process.env, timeoutMs = 30000 }) {
  const holder = profileHolder(profile);
  if (holder !== undefined) {
    const active = readActivePort(profile);
    if (active && await endpointAlive(active)) return { ...active, pid: holder, launched: false };
    throw new Error("pro-review transport: a browser window (pid " + holder + ") holds the Pro profile without a DevTools endpoint. " +
      "Do not kill it: a person may be using it. Ask them to quit that window, then retry. Nothing was sent.");
  }
  rmSync(join(profile, "DevToolsActivePort"), { force: true });
  // Nobody holds this automation-only profile, so its saved tabs are nobody's work. Some
  // browsers (Brave) restore them when the first tab opens, even headless, and a
  // restored ChatGPT tab would keep the browser alive after the run.
  rmSync(join(profile, "Default", "Sessions"), { recursive: true, force: true });
  const nativeKeychain = usesNativeKeychain(profile);
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  const flags = chromeFlags({ profile, hidden, nativeKeychain });
  // Headless Chrome never registers a window with the window server, so spawning its
  // binary directly cannot activate it (unlike a windowed launch).
  const child = spawn(chromePath(env), [...flags, ...(hidden ? [] : ["about:blank"])], { detached: true, stdio: "ignore" });
  child.unref();
  const pid = child.pid;
  if (nativeKeychain && !NATIVE_KEYCHAIN_MARKERS.some((name) => existsSync(join(profile, name)))) {
    writeFileSync(join(profile, NATIVE_KEYCHAIN_MARKERS[0]), "native-keychain\n");
  }
  const active = await until(() => readActivePort(profile), { timeoutMs, what: "Chrome's DevTools endpoint" });
  return { ...active, pid: pid ?? profileHolder(profile), launched: true, background: hidden };
}

/**
 * Open a plain, visible Chrome on the profile for a person to sign in (no DevTools
 * port, so Google accepts it). Refuses while another Chrome holds the profile.
 */
export function launchForSignIn({ profile, env = process.env }) {
  const holder = profileHolder(profile);
  if (holder !== undefined) throw new Error("pro-review transport: a browser window (pid " + holder + ") already holds the Pro profile; ask the person to quit it (Cmd+Q), then retry");
  const nativeKeychain = usesNativeKeychain(profile);
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  const child = spawn(chromePath(env), [...chromeFlags({ profile, nativeKeychain, signIn: true }), CHATGPT_URL + "auth/login"], { detached: true, stdio: "ignore" });
  child.unref();
  if (nativeKeychain && !NATIVE_KEYCHAIN_MARKERS.some((name) => existsSync(join(profile, name)))) {
    writeFileSync(join(profile, NATIVE_KEYCHAIN_MARKERS[0]), "native-keychain\n");
  }
  return { pid: child.pid, nativeKeychain };
}

/** A minimal DevTools-protocol client over Node's built-in WebSocket (flattened sessions). */
export class Cdp {
  static async connect({ port, path }, timeoutMs = 10000) {
    const socket = new WebSocket("ws://127.0.0.1:" + port + path);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("pro-review transport: DevTools connection timed out")), timeoutMs);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("pro-review transport: DevTools connection failed")); }, { once: true });
    });
    return new Cdp(socket);
  }
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error("pro-review transport: " + waiter.method + " failed: " + message.error.message));
        else waiter.resolve(message.result);
      } else for (const listener of this.listeners) listener(message);
    });
    socket.addEventListener("close", () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error("pro-review transport: DevTools connection closed"));
      this.pending.clear();
    });
  }
  /** Every call is bounded: a DevTools endpoint that never answers fails the call, not the run's deadline. */
  send(method, params = {}, sessionId, timeoutMs = 120000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("pro-review transport: DevTools call " + method + " timed out after " + Math.round(timeoutMs / 1000) + "s"));
      }, timeoutMs);
      const settle = (fn) => (value) => { clearTimeout(timer); fn(value); };
      this.pending.set(id, { resolve: settle(resolve), reject: settle(reject), method });
      try { this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); } catch (error) { this.pending.get(id)?.reject(error); this.pending.delete(id); }
    });
  }
  close() { try { this.socket.close(); } catch { /* already closed */ } }
}

const TRANSIENT_CONTEXT = /Cannot find default execution context|Execution context was destroyed|Cannot find context with specified id|Inspected target navigated/i;

/** One attached page target with the handful of operations the flow needs. */
export class Page {
  static async open(cdp, url, { background = true } = {}) {
    // Open on about:blank and navigate only once the page is prepared, so ChatGPT never
    // sees a headless user agent. In a windowed Chrome (one kept open for a person) a
    // background page gets its own unfocused window, pinned off-screen.
    const { product, userAgent } = await cdp.send("Browser.getVersion");
    const headless = /Headless/i.test(product + " " + userAgent);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", background, ...(background && !headless ? { newWindow: true } : {}) });
    if (background && !headless) {
      const placed = await cdp.send("Browser.getWindowForTarget", { targetId }).catch(() => undefined);
      if (placed) await cdp.send("Browser.setWindowBounds", { windowId: placed.windowId, bounds: { windowState: "normal", left: -32000, top: -32000, width: 1280, height: 900 } }).catch(() => {});
    }
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, targetId, sessionId);
    await page.send("Page.enable");
    // No Runtime.enable: Runtime.evaluate works without it, and an enabled Runtime domain is
    // a known bot signal (Cloudflare probes for its console serialization side effects).
    // A background page still has to behave as focused for ChatGPT's composer and send button.
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
    if (headless) {
      // The user-agent string and the client hints must agree; a hint still naming
      // HeadlessChrome next to a normal UA is exactly what bot checks look for.
      const version = /Chrome\/([\d.]+)/.exec(userAgent)?.[1] ?? "0.0.0.0";
      const major = version.split(".")[0];
      const brands = [{ brand: "Google Chrome", version: major }, { brand: "Chromium", version: major }, { brand: "Not=A?Brand", version: "24" }];
      await page.send("Emulation.setUserAgentOverride", {
        userAgent: userAgent.replace(/HeadlessChrome/g, "Chrome"), acceptLanguage: "en-US,en", platform: "MacIntel",
        userAgentMetadata: { brands, fullVersionList: brands.map((item) => ({ ...item, version: item.brand === "Not=A?Brand" ? "24.0.0.0" : version })),
          platform: "macOS", platformVersion: "15.0.0", architecture: "arm", model: "", mobile: false, bitness: "64", wow64: false },
      });
      await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false }).catch(() => {});
    }
    await page.navigate(url);
    return page;
  }
  constructor(cdp, targetId, sessionId) { Object.assign(this, { cdp, targetId, sessionId }); }
  send(method, params) { return this.cdp.send(method, params, this.sessionId); }
  /**
   * Evaluate in the page. While a page loads or navigates Chrome briefly has no
   * execution context; only those transient errors are retried, for at most ~5 s.
   */
  async evaluate(expression) {
    let response;
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        break;
      } catch (error) {
        if (attempt >= 20 || !TRANSIENT_CONTEXT.test(error.message)) throw error;
        await pause(250);
      }
    }
    const { result, exceptionDetails } = response;
    if (exceptionDetails) throw new Error("pro-review transport: page script failed: " + (exceptionDetails.exception?.description ?? exceptionDetails.text));
    return result.value;
  }
  navigate(url) { return this.send("Page.navigate", { url }); }
  close() { return this.cdp.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {}); }
  /** A trusted mouse click at the centre of the first element matching `selector`. */
  async click(selector) {
    const box = await this.evaluate("(() => { const node = " + findExpression(selector) + "; if (!node) return null; node.scrollIntoView({ block: 'center' });" +
      " const r = node.getBoundingClientRect(); return r.width && r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()");
    if (!box) return false;
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
      await this.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1 });
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// ChatGPT page knowledge. Every DOM assumption lives in SELECTORS; everything that
// can be read from ChatGPT's own backend API is read there instead, inside the page,
// so the access token never leaves the browser.

export const SELECTORS = {
  composer: "#prompt-textarea, div[contenteditable='true'][role='textbox'], form div[contenteditable='true'], form textarea",
  modelButton: "button[aria-label='Select ChatGPT model'], button[data-testid='model-switcher-dropdown-button'], button[aria-label*='model' i][aria-haspopup='menu']",
  send: "button[data-testid='send-button'], button#composer-submit-button, button[aria-label='Send'], button[aria-label='Send message'], button[aria-label='Send prompt']",
  stop: "button[data-testid='stop-button'], button[aria-label='Stop streaming'], button[aria-label='Stop generating']",
  fileInput: "input[type='file']",
};

/** The exact GPT-6 Pro label: a generic "Pro" chip cannot prove the generation. */
export const PRO_LABEL = /^(?:ChatGPT\s+)?(?:GPT[- ]?)?6(?:\.\d+)?\s*Pro$/i;
export const isProLabel = (text) => PRO_LABEL.test(String(text ?? "").replace(/\s+/g, " ").trim());

function findExpression(selector) {
  return "Array.from(document.querySelectorAll(" + JSON.stringify(selector) + ")).find((n) => n.getClientRects().length > 0)";
}

/**
 * Call ChatGPT's backend from inside the page with the page's own session. The access
 * token is cached in the page (it never leaves the browser) and refreshed once on 401,
 * so a long wait costs one request per poll.
 */
export async function pageApi(page, path) {
  return page.evaluate("(async () => {" +
    " const token = async (fresh) => { if (!fresh && window.__proReviewToken) return window.__proReviewToken;" +
    "   const s = await fetch('/api/auth/session', { credentials: 'include', signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null);" +
    "   window.__proReviewToken = s?.accessToken ?? null; return window.__proReviewToken; };" +
    " const call = async (fresh) => { const t = await token(fresh); if (!t) return { status: 401, body: null };" +
    "   const r = await fetch(" + JSON.stringify(path) + ", { credentials: 'include', headers: { authorization: 'Bearer ' + t }, signal: AbortSignal.timeout(60000) });" +
    "   let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; };" +
    " const first = await call(false); return first.status === 401 ? call(true) : first; })()");
}

/** Signed-in state and plan from /api/auth/session; never returns the token. */
export async function accountState(page) {
  return page.evaluate("(async () => { const s = await fetch('/api/auth/session', { credentials: 'include', signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null);" +
    " return { signedIn: Boolean(s?.accessToken), plan: s?.account?.planType ?? s?.account?.plan_type ?? null }; })()");
}

const CHALLENGE = "(/^(Just a moment|Attention Required|Verify you are human)/i.test(document.title) ||" +
  " Boolean(document.querySelector('iframe[src*=\"challenges.cloudflare.com\"], #challenge-form, #cf-challenge-running')))";

export async function waitForComposer(page, timeoutMs) {
  await until(() => page.evaluate("document.readyState === 'complete'"), { timeoutMs, what: "chatgpt.com to load" });
  if (await page.evaluate(CHALLENGE)) {
    // Give an automatic check a moment to clear itself before asking a person.
    // Cloudflare's managed check usually passes by itself in a real browser; give it time
    // before asking a person.
    const cleared = await until(() => page.evaluate("!" + CHALLENGE), { timeoutMs: 45000, intervalMs: 1000, what: "the browser check" }).catch(() => false);
    if (!cleared) throw new TransportError("challenge", "chatgpt.com is showing a browser check (Cloudflare). Run `chatgpt-transport.mjs login`, let the check pass in that plain window, quit it, then retry. Nothing was sent.");
  }
  // The session endpoint answers {} until the page has hydrated its auth state, so one
  // empty reading is not "signed out": poll, and only call it signed out after a
  // bounded settle window with no token.
  // A browser check can also appear after the load event; one seen while waiting is reported as such, never as "signed out".
  const settleMs = Math.min(timeoutMs, 20000);
  let challenged = false;
  const account = await until(async () => {
    if (await page.evaluate(CHALLENGE).catch(() => false)) { challenged = true; return undefined; }
    return accountState(page).then((state) => (state.signedIn ? state : undefined)).catch(() => undefined);
  }, { timeoutMs: settleMs, intervalMs: 1000, what: "a signed-in ChatGPT session" }).catch(() => ({ signedIn: false, plan: null }));
  if (!account.signedIn && challenged) throw new TransportError("challenge", "chatgpt.com is showing a browser check (Cloudflare). Run `chatgpt-transport.mjs login`, let the check pass in that plain window, quit it, then retry. Nothing was sent.");
  if (!account.signedIn) return { ...account, composer: false };
  await until(() => page.evaluate("Boolean(" + findExpression(SELECTORS.composer) + ")"), { timeoutMs, what: "the ChatGPT composer" });
  return { ...account, composer: true };
}

// The October 2026 picker is one menu with two controls: model radio rows
// ([role=menuitemradio], in a second view behind the "Select model" row) and a
// five-step effort slider ("Power": [data-reasoning-slider] with a role=status
// label such as "Instant, 1 of 5."). Pro means: the GPT-6 row checked AND the
// effort label Pro. Legacy single-button labels ("GPT-6 Pro") still count.

const PICKER_STATE = "(() => {" +
  " const text = (n) => (n?.innerText || n?.textContent || '').replace(/\\s+/g, ' ').trim();" +
  " const button = " + findExpression(SELECTORS.modelButton) + ";" +
  " const menu = document.querySelector('[role=\"menu\"][data-state=\"open\"]');" +
  " const models = menu ? Array.from(menu.querySelectorAll('[role=\"menuitemradio\"]')).map((n) => ({ text: text(n.querySelector('[data-menu-row-content]') ?? n).replace(/\\s*(Locked, opens access options|Usage limit reached)\\s*/g, ' ').trim(), checked: n.getAttribute('aria-checked') === 'true', disabled: n.getAttribute('aria-disabled') === 'true' })) : [];" +
  " const slider = menu?.querySelector('[data-reasoning-slider]');" +
  " const statusId = (slider?.getAttribute('aria-describedby') || '').split(/\\s+/)[0];" +
  " const status = statusId ? text(document.getElementById(statusId)) : '';" +
  " const knob = slider?.querySelector('[role=\"slider\"]');" +
  " const lock = slider?.querySelector('[data-locked]');" +
  " return { button: button ? text(button) : null, open: Boolean(menu), models," +
  "   effort: slider ? { label: status.split(',')[0].trim() || null, status, value: Number(knob?.getAttribute('aria-valuenow') ?? NaN), max: Number(knob?.getAttribute('aria-valuemax') ?? NaN), locked: lock?.getAttribute('data-locked') === 'true' } : null };" +
  " })()";

async function pressKey(page, key, code, keyCode) {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
}
async function openPicker(page) {
  const state = await page.evaluate(PICKER_STATE);
  if (state.open) return state;
  if (!state.button) {
    await until(() => page.evaluate("Boolean(" + findExpression(SELECTORS.modelButton) + ")"), { timeoutMs: 20000, what: "the ChatGPT model picker button" });
  }
  // A click that lands while ChatGPT is still hydrating only shows the button's tooltip,
  // so click again (bounded) until the menu is really open.
  const deadline = Date.now() + 20000;
  const ready = (next) => (next.open && (next.effort || next.models.length) ? next : undefined);
  for (;;) {
    // Never click a menu that opened late: a second click would close it again.
    const late = ready(await page.evaluate(PICKER_STATE));
    if (late) return late;
    await page.click(SELECTORS.modelButton);
    const opened = await until(() => page.evaluate(PICKER_STATE).then(ready),
      { timeoutMs: 3000, intervalMs: 150, what: "the model picker menu to open" }).catch(() => undefined);
    if (opened) return opened;
    if (Date.now() >= deadline) throw new Error("pro-review transport: timed out after 20s waiting for the model picker menu to open");
  }
}
async function closePicker(page) {
  if ((await page.evaluate(PICKER_STATE)).open) await pressKey(page, "Escape", "Escape", 27);
}

/** Read the model picker without changing it; the menu is closed again before returning. */
export async function readPicker(page) {
  const state = await openPicker(page);
  await closePicker(page);
  return state;
}

/** Decide from one picker reading whether GPT-6 at Pro effort is selected. */
export const GPT6_MODEL = /^(?:ChatGPT\s+)?GPT[- ]?6(?:\.\d+)?(?:\s+Latest)?$/i;
export function proSelection(reading) {
  const model = (reading?.models ?? []).find((row) => row.checked)?.text ?? null;
  const effort = reading?.effort?.label ?? null;
  const legacy = isProLabel(reading?.button);
  const ok = legacy || (GPT6_MODEL.test(model ?? "") && /^pro$/i.test(effort ?? ""));
  return {
    ok,
    label: legacy ? reading.button : [model, effort].filter(Boolean).join(" + ") || reading?.button || null,
    model,
    effort,
    effortStep: reading?.effort ? { value: reading.effort.value, max: reading.effort.max, status: reading.effort.status, locked: reading.effort.locked === true } : null,
    models: (reading?.models ?? []).map((row) => row.text),
  };
}

/**
 * Switch to GPT-6 at Pro effort, then re-read: a selection counts only when observed
 * after the menu was closed and opened again. Steps the effort slider with the arrow
 * keys and records every label it passes, so a renamed step is visible in evidence.
 */
export async function selectPro(page) {
  const steps = [];
  let state = await openPicker(page);
  const gpt6 = state.models.find((row) => GPT6_MODEL.test(row.text));
  if (gpt6 && !gpt6.checked) {
    await page.evaluate("(() => { const row = Array.from(document.querySelectorAll('[role=\"menu\"][data-state=\"open\"] [role=\"menuitemradio\"]'))" +
      ".find((n) => " + GPT6_MODEL.toString() + ".test((n.querySelector('[data-menu-row-content]') ?? n).innerText.replace(/\\s*(Locked, opens access options|Usage limit reached)\\s*/g, ' ').trim())); row?.click(); })()");
    await closePicker(page);
    state = await openPicker(page);
  }
  if (state.effort) {
    steps.push(state.effort.label);
    const focused = await page.evaluate("(() => { const s = document.querySelector('[role=\"menu\"][data-state=\"open\"] [data-reasoning-slider]'); s?.focus(); return document.activeElement === s; })()");
    if (focused) {
      // Walk right until the label reads Pro or the slider stops moving.
      for (let guard = 0; guard <= (Number.isFinite(state.effort.max) ? state.effort.max : 6) && !/^pro$/i.test(state.effort.label ?? ""); guard += 1) {
        const before = state.effort.status;
        await pressKey(page, "ArrowRight", "ArrowRight", 39);
        state = await until(() => page.evaluate(PICKER_STATE).then((next) => (next.effort && next.effort.status !== before ? next : undefined)),
          { timeoutMs: 2000, intervalMs: 100, what: "the effort slider to move" }).catch(() => undefined) ?? state;
        if (state.effort.status === before) break;
        steps.push(state.effort.label);
      }
    }
  }
  await closePicker(page);
  return { ...proSelection(await readPicker(page)), steps };
}

/** Say why Pro could not be selected, in the words a person can act on. */
export function proFailure(stage, pro) {
  const after = pro.evidence?.afterSelect;
  const seen = after?.steps?.length ? " (effort steps reached: " + after.steps.join(" > ") + ")" : "";
  const locked = after?.effortStep?.locked || pro.evidence?.observed?.effortStep?.locked;
  const reason = locked || (after?.steps?.length && !/^pro$/i.test(after.steps.at(-1)))
    ? "the Pro effort step is locked, most likely by the Pro usage limit; wait for it to reset"
    : after && !after.model ? "the GPT-6 model row was not found in the picker"
      : "the picker did not settle on GPT-6 + Pro";
  return "GPT-6 Pro is not selected " + stage + ": picker shows " + (pro.label ?? "nothing") + seen + "; " + reason + ". Nothing was sent.";
}

/** The pre-submit gate: observe, select Pro when allowed and needed, observe again. */
export async function ensurePro(page, { select = true } = {}) {
  const first = proSelection(await readPicker(page));
  const evidence = { source: "chatgpt-model-picker", capturedAt: new Date().toISOString(), observed: first };
  if (first.ok) return { ok: true, label: first.label, status: "already-selected", evidence };
  if (!select) return { ok: false, label: first.label, status: "not-pro", evidence };
  const second = await selectPro(page);
  evidence.afterSelect = second;
  return { ok: second.ok, label: second.label, status: second.ok ? "switched" : "not-pro", evidence };
}

/**
 * The editor re-flows whitespace (paragraph breaks, trailing newlines), so typed text is
 * compared with every whitespace run collapsed to one space: word and line boundaries
 * still count. A big paste is compared byte for byte instead (serverEvidence).
 */
export const compactText = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

/**
 * Put exactly the prompt into a cleared composer by one synthetic paste. Typing is
 * unusable for scopes (CDP insertText took 18 s for 30k characters and stalls beyond);
 * a paste lands 100k characters in under a second. ChatGPT keeps a short paste as
 * text and turns a long one into a "Pasted text" chip (a big_paste attachment that Pro
 * reads in full: verified with markers at the start, middle and end of 150k
 * characters). Returns which of the two happened; anything else sends nothing.
 */
const CHIPS = "Array.from((" + findExpression(SELECTORS.composer) + ")?.closest('form')?.querySelectorAll('*') ?? [])" +
  ".filter((e) => e.children.length === 0 && /^(Pasted text|Adding pasted text…)$/.test((e.textContent || '').trim())).map((e) => e.textContent.trim())";
export async function typePrompt(page, text, { settleMs = 4000, timeoutMs = 60000 } = {}) {
  const composer = findExpression(SELECTORS.composer);
  const state = () => page.evaluate("(() => { const n = " + composer + "; return n ? { value: n.value ?? n.innerText ?? '', chips: " + CHIPS + " } : null; })()");
  const focused = await page.evaluate("(() => { const n = " + composer + "; if (!n) return false; n.focus();" +
    " if ('value' in n && n.tagName === 'TEXTAREA') { n.select(); } else { document.execCommand('selectAll'); }" +
    " document.execCommand('delete'); return document.activeElement === n || n.contains(document.activeElement); })()");
  if (!focused) throw new Error("pro-review transport: could not focus the ChatGPT composer; nothing was sent");
  const before = await state();
  if (compactText(before.value).length > 0) throw new Error("pro-review transport: could not clear the composer draft (" + compactText(before.value).length + " characters left); nothing was sent");
  if (before.chips.length > 0) throw new Error("pro-review transport: the composer already holds a pasted-text attachment from an earlier draft; remove it, then retry. Nothing was sent.");
  const pasted = await page.evaluate("(() => { const n = " + composer + "; n.focus(); const data = new DataTransfer(); data.setData('text/plain', " + JSON.stringify(text) + ");" +
    " return n.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })) === false; })()");
  if (!pasted) throw new Error("pro-review transport: the composer did not take the paste; nothing was sent");
  const started = Date.now();
  const want = compactText(text);
  for (;;) {
    const now = await state();
    const chips = now?.chips ?? [];
    if (chips.length === 1 && chips[0] === "Pasted text" && compactText(now.value).length === 0) return { mode: "big-paste", bytes: Buffer.byteLength(text, "utf8") };
    // A paste can turn into a chip a moment after it lands, so inline counts only once it has stayed text.
    if (chips.length === 0 && compactText(now?.value) === want && Date.now() - started >= settleMs) return { mode: "inline", bytes: Buffer.byteLength(text, "utf8") };
    if (Date.now() - started >= timeoutMs) {
      throw new Error("pro-review transport: the pasted prompt did not settle (" + compactText(now?.value).length + " of " + want.length + " characters, chips: " + (chips.join(", ") || "none") + "); nothing was sent");
    }
    await pause(250);
  }
}

/**
 * Upload files through the composer's general file input (the first inputs accept only
 * images), then wait until every file's tile is shown, no upload progress remains and
 * Send is enabled. Run after typePrompt: Send is only meaningful with text present.
 */
const TILES = "(() => { const form = (" + findExpression(SELECTORS.composer) + ")?.closest('form'); if (!form) return [];" +
  " const texts = Array.from(form.querySelectorAll('*')).filter((e) => e.children.length === 0).map((e) => (e.textContent || '').trim());" +
  " const labels = Array.from(form.querySelectorAll('[aria-label], img[alt]')).map((e) => (e.getAttribute('aria-label') || e.getAttribute('alt') || '').trim());" +
  " return [...texts, ...labels].filter(Boolean); })()";
export async function attachFiles(page, files, timeoutMs) {
  if (files.length === 0) return;
  const { root } = await page.send("DOM.getDocument", { depth: 0 });
  const { nodeIds = [] } = await page.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: SELECTORS.fileInput });
  let general;
  for (const nodeId of nodeIds) {
    const { attributes = [] } = await page.send("DOM.getAttributes", { nodeId });
    const accept = attributes[attributes.indexOf("accept") + 1];
    if (!attributes.includes("accept") || !/image|video/i.test(accept ?? "")) { general = nodeId; break; }
  }
  if (general === undefined) throw new Error("pro-review transport: ChatGPT shows no general file input (only image inputs); nothing was sent");
  await page.send("DOM.setFileInputFiles", { nodeId: general, files });
  const names = files.map((file) => basename(file));
  const patterns = names.map((name) => tilePattern(name).toString());
  await until(() => page.evaluate("(() => { const tiles = " + TILES + "; const form = (" + findExpression(SELECTORS.composer) + ")?.closest('form');" +
    " const busy = form?.querySelector('[role=\"progressbar\"], [aria-busy=\"true\"]'); const b = " + findExpression(SELECTORS.send) + ";" +
    " return [" + patterns.join(", ") + "].every((name) => tiles.some((tile) => name.test(tile))) && !busy && Boolean(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; })()"),
    { timeoutMs, intervalMs: 500, what: "the upload of " + names.join(", ") + " to finish" });
}

/** A file's tile text: its exact name, or the name ChatGPT gives a repeat upload ("name(1).zip"). */
export function tilePattern(name) {
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  const quote = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + quote(stem) + "(?:\\(\\d+\\))?" + quote(ext) + "$");
}

/** Whether every named upload still shows as a tile in the composer. */
export async function tilesHold(page, files) {
  if (files.length === 0) return true;
  const tiles = await page.evaluate(TILES);
  return files.map((file) => tilePattern(basename(file))).every((name) => tiles.some((tile) => name.test(tile)));
}

/** Whether the composer still holds exactly what typePrompt settled on. */
export async function composerHolds(page, text, mode) {
  const now = await page.evaluate("(() => { const n = " + findExpression(SELECTORS.composer) + "; return n ? { value: n.value ?? n.innerText ?? '', chips: " + CHIPS + " } : null; })()");
  if (!now) return false;
  return mode === "big-paste"
    ? now.chips.length === 1 && now.chips[0] === "Pasted text" && compactText(now.value) === ""
    : now.chips.length === 0 && compactText(now.value) === compactText(text);
}

export async function submit(page, timeoutMs, onClicked = () => {}, verify = async () => true) {
  await until(() => page.evaluate("(() => { const b = " + findExpression(SELECTORS.send) + "; return Boolean(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; })()"),
    { timeoutMs, what: "an enabled send button" });
  if (!await verify()) throw new Error("pro-review transport: the composer changed after the prompt was checked; nothing was sent");
  if (!await page.click(SELECTORS.send)) throw new Error("pro-review transport: the send button vanished; nothing was sent");
  onClicked();
  return until(() => page.evaluate("(/^\\/c\\/([0-9a-f-]{20,})/i.exec(location.pathname) || [])[1]"), { timeoutMs, what: "ChatGPT to open the new conversation" });
}

/**
 * The answer to the conversation's FIRST user turn (the one this run sent), from the
 * backend record, with the model the server recorded. Later turns or branches never
 * replace it. `done` is true only for a finished final message of that exchange.
 */
export function latestAnswer(conversation) {
  const mapping = conversation?.mapping ?? {};
  const path = [];
  for (let node = mapping[conversation?.current_node]; node; node = mapping[node.parent]) path.unshift(node);
  const first = path.findIndex((node) => node.message?.author?.role === "user");
  if (first < 0) return { done: false, attachments: [], userText: "" };
  const next = path.findIndex((node, index) => index > first && node.message?.author?.role === "user");
  const exchange = path.slice(first + 1, next < 0 ? path.length : next);
  const user = path[first];
  const userParts = user.message?.content?.parts ?? [];
  const sent = {
    userText: userParts.filter((part) => typeof part === "string").join("\n"),
    userMessageId: user.message?.id ?? null,
    attachments: (user.message?.metadata?.attachments ?? []).filter(Boolean).map((file) => ({ id: file.id ?? null, name: file.name ?? null, size: file.size ?? null, bigPaste: file.is_big_paste === true })),
  };
  const node = exchange.filter((item) => item.message?.author?.role === "assistant" && (item.message.recipient ?? "all") === "all" &&
    ["text", "multimodal_text"].includes(item.message.content?.content_type)).at(-1);
  if (!node) return { done: false, ...sent };
  const message = node.message;
  const text = (message.content.parts ?? []).filter((part) => typeof part === "string").join("\n").trim();
  const metadata = message.metadata ?? {};
  const effort = metadata.thinking_effort ?? metadata.reasoning_effort ?? metadata.effort ?? null;
  return {
    done: message.status === "finished_successfully" && message.end_turn !== false && text.length > 0,
    // Any other terminal status (partial completion, error) will never become a report.
    failed: typeof message.status === "string" && /^finished_/.test(message.status) && message.status !== "finished_successfully",
    status: message.status ?? null,
    ...sent,
    text,
    modelSlug: metadata.model_slug ?? null,
    requestedModelSlug: metadata.requested_model_slug ?? null,
    defaultModelSlug: metadata.default_model_slug ?? conversation?.default_model_slug ?? null,
    effort: typeof effort === "string" ? effort : null,
    messageId: message.id ?? null,
  };
}

/** SHA-256 (hex) of a stored attachment (big paste or upload), downloaded inside the page with its own session. */
export async function attachmentDigest(page, conversationId, fileId) {
  return page.evaluate("(async () => {" +
    " const s = await fetch('/api/auth/session', { credentials: 'include', signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null);" +
    " if (!s?.accessToken) return null; const headers = { authorization: 'Bearer ' + s.accessToken };" +
    " const meta = await fetch('/backend-api/files/download/' + encodeURIComponent(" + JSON.stringify(fileId) + ") + '?conversation_id=' + encodeURIComponent(" + JSON.stringify(conversationId) + ") + '&inline=false', { credentials: 'include', headers, signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null);" +
    " if (!meta?.download_url) return null; const url = new URL(meta.download_url, location.href);" +
    " const file = await fetch(url, url.host === location.host ? { credentials: 'include', headers, signal: AbortSignal.timeout(60000) } : { signal: AbortSignal.timeout(60000) }).catch(() => null);" +
    " if (!file?.ok) return null; const bytes = new Uint8Array(await file.arrayBuffer());" +
    " return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join(''); })()");
}

/**
 * ChatGPT's own record of the run: the answering model, and whether the sent user turn
 * is exactly our prompt with every attachment. `meta` supplies the hashes on recover.
 */
export function serverEvidence(answer, prompt, uploads, meta, digests) {
  const exactSha = prompt !== undefined ? createHash("sha256").update(prompt).digest("hex") : meta?.promptSha256;
  const normSha = prompt !== undefined ? createHash("sha256").update(compactText(prompt)).digest("hex") : meta?.normPromptSha256;
  const expected = uploads ?? meta?.uploads;
  const pastes = answer.attachments.filter((file) => file.bigPaste);
  const others = answer.attachments.filter((file) => !file.bigPaste);
  const inline = pastes.length === 0 && normSha !== undefined && createHash("sha256").update(compactText(answer.userText)).digest("hex") === normSha;
  // A big paste counts only when ChatGPT's stored copy hashes to the exact approved prompt.
  const pasted = compactText(answer.userText) === "" && pastes.length === 1 && exactSha !== undefined && digests?.[pastes[0].id] === exactSha;
  // Every upload, and nothing else, must be stored byte for byte as approved.
  const stored = others.map((file) => digests?.[file.id] ?? null).sort();
  const approved = (expected ?? []).map((file) => file.sha256).sort();
  const uploadsOk = Array.isArray(expected) && stored.length === approved.length && stored.every((sha, index) => sha !== null && sha === approved[index]);
  const known = normSha !== undefined && exactSha !== undefined && Array.isArray(expected);
  return {
    modelSlug: answer.modelSlug, requestedModelSlug: answer.requestedModelSlug, effort: answer.effort, pro: serverPro(answer),
    // true only with the run's own hashes; sessions recorded without them are never verified.
    promptVerified: known && (inline || pasted) && uploadsOk,
    sentAs: pasted ? "big-paste" : inline ? "inline" : "unverified",
    uploadsVerified: uploadsOk,
    attachments: answer.attachments.map((file) => file.name),
  };
}

/**
 * Download one stored file (an upload or a file Pro created) inside the page with its own
 * session; returns { bytes, name } or null. Capped so a runaway output cannot fill the disk.
 */
export const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;
export async function fetchStoredFile(page, conversationId, fileId) {
  const result = await page.evaluate("(async () => {" +
    " const s = await fetch('/api/auth/session', { credentials: 'include', signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null);" +
    " if (!s?.accessToken) return null; const headers = { authorization: 'Bearer ' + s.accessToken };" +
    " const meta = await fetch('/backend-api/files/download/' + encodeURIComponent(" + JSON.stringify(fileId) + ") + '?conversation_id=' + encodeURIComponent(" + JSON.stringify(conversationId) + ") + '&inline=false', { credentials: 'include', headers, signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null);" +
    " if (!meta?.download_url) return null; if ((meta.file_size_bytes ?? 0) > " + MAX_OUTPUT_BYTES + ") return { tooLarge: meta.file_size_bytes };" +
    " const url = new URL(meta.download_url, location.href);" +
    " const file = await fetch(url, url.host === location.host ? { credentials: 'include', headers, signal: AbortSignal.timeout(120000) } : { signal: AbortSignal.timeout(120000) }).catch(() => null);" +
    " if (!file?.ok) return null; const bytes = new Uint8Array(await file.arrayBuffer()); if (bytes.length > " + MAX_OUTPUT_BYTES + ") return { tooLarge: bytes.length };" +
    " let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));" +
    " return { base64: btoa(binary), name: meta.file_name ?? null }; })()");
  if (!result) return null;
  if (result.tooLarge) throw new TransportError("output_too_large", "a stored file is " + result.tooLarge + " bytes, over the " + MAX_OUTPUT_BYTES + "-byte limit");
  return { bytes: Buffer.from(result.base64, "base64"), name: result.name };
}

/**
 * Files Pro created in this exchange: every successful library-write receipt in its tool
 * output (sandbox path -> file id), every file referenced from its answers' metadata
 * (content_references of type "file"), every generated image in its answers, and every
 * sandbox: link in the final answer (a link with no saved copy is reported as unavailable).
 */
/** ChatGPT renames a repeated Library or upload name to "name(1).ext"; the output keeps its real name. */
export const withoutRename = (name) => String(name).replace(/\(\d+\)(?=\.[^.]*$|$)/, "");

const RECEIPT = /__OPENAI_LIBRARY_FILE_WRITE_RECEIPT_V1__=(\{[^\n]*\})/g;
export function outputFiles(conversation, finalText = "") {
  const mapping = conversation?.mapping ?? {};
  const path = [];
  for (let node = mapping[conversation?.current_node]; node; node = mapping[node.parent]) path.unshift(node);
  const first = path.findIndex((node) => node.message?.author?.role === "user");
  const next = path.findIndex((node, index) => index > first && node.message?.author?.role === "user");
  const exchange = first < 0 ? [] : path.slice(first + 1, next < 0 ? path.length : next);
  const byPath = new Map();
  const outputs = [];
  for (const node of exchange) {
    const message = node.message ?? {};
    const text = typeof message.content?.text === "string" ? message.content.text : "";
    for (const match of text.matchAll(RECEIPT)) {
      let receipt;
      try { receipt = JSON.parse(match[1]); } catch { continue; }
      if (typeof receipt.file_id !== "string" || typeof receipt.sandbox_path !== "string" || byPath.has(receipt.sandbox_path)) continue;
      byPath.set(receipt.sandbox_path, receipt.file_id);
    }
    if (message.author?.role === "assistant" && (message.recipient ?? "all") === "all") {
      // A file Pro saved for the user is also referenced from the answer's metadata
      // (type "file", a downloadable file id, and its Library id behind the link).
      for (const ref of message.metadata?.content_references ?? []) {
        if (ref?.type !== "file" || typeof ref.id !== "string" || !/^file[-_]/.test(ref.id)) continue;
        if (!outputs.some((item) => item.fileId === ref.id) && ![...byPath.values()].includes(ref.id)) {
          outputs.push({ name: typeof ref.name === "string" && ref.name ? withoutRename(ref.name) : ref.id, fileId: ref.id, source: "saved file" });
        }
      }
      for (const part of message.content?.parts ?? []) {
        const pointer = typeof part === "object" && part?.content_type === "image_asset_pointer" ? part.asset_pointer : undefined;
        const fileId = typeof pointer === "string" ? /^(?:sediment|file-service):\/\/(file[-_][A-Za-z0-9_-]+)$/.exec(pointer)?.[1] : undefined;
        if (fileId && !outputs.some((item) => item.fileId === fileId)) outputs.push({ name: "image-" + (outputs.length + 1) + ".png", fileId, source: "generated image" });
      }
    }
  }
  const linked = [...finalText.matchAll(/sandbox:(\/[^)\s]+)/g)].map((match) => match[1]);
  for (const sandboxPath of new Set([...byPath.keys(), ...linked])) {
    // A sandbox link to a file already saved under the same name is the same output.
    if (!byPath.has(sandboxPath) && outputs.some((item) => item.fileId && item.name === withoutRename(sandboxPath.split("/").pop()))) continue;
    outputs.push({ name: sandboxPath.split("/").pop() || "output", fileId: byPath.get(sandboxPath) ?? null, sandboxPath, source: byPath.has(sandboxPath) ? "saved file" : "linked without a saved copy" });
  }
  return outputs;
}

/** Download every output; each is { name, bytes, sha256 } or { name, error }. */
export async function collectOutputs(page, conversationId, conversation, finalText) {
  const results = [];
  for (const item of outputFiles(conversation, finalText)) {
    if (!item.fileId) { results.push({ ...item, error: "ChatGPT kept no downloadable copy" }); continue; }
    try {
      const file = await fetchStoredFile(page, conversationId, item.fileId);
      if (!file) { results.push({ ...item, error: "download failed" }); continue; }
      results.push({ ...item, bytes: file.bytes, sha256: createHash("sha256").update(file.bytes).digest("hex") });
    } catch (error) { results.push({ ...item, error: error.message }); }
  }
  return results;
}

/** SHA-256 of every stored attachment of the answer's user turn, keyed by file id (null when unreadable). */
async function digestsFor(page, conversationId, answer) {
  const out = {};
  for (const file of answer.attachments.filter((item) => item.id)) out[file.id] = await attachmentDigest(page, conversationId, file.id).catch(() => null);
  return out;
}

/** Server-side evidence counts as Pro when the recorded slug or effort names GPT-6 Pro. */
export function serverPro(answer) {
  // Only the model that actually answered counts; a requested slug proves nothing.
  const slug = answer?.modelSlug ?? "";
  return /^gpt-6(?:[.-]\d+)?-pro\b/i.test(slug) || (/^gpt-6(?:[.-]\d+)?$/i.test(slug) && /^pro$/i.test(answer?.effort ?? ""));
}

const BROWSER_GONE = /DevTools connection closed|No target with given id|Target closed|Session with given id not found|Inspected target navigated or closed/i;

/**
 * Poll ChatGPT's record of the conversation until the answer is final. Polls every 3 s
 * for the first minute, then every 10 s (Pro answers take minutes). A lost browser, an
 * expired session or a failed answer ends the wait at once instead of at the deadline.
 */
export async function waitForAnswer(page, conversationId, { timeoutMs, onProgress, fastMs = 3000, slowMs = 10000 } = {}) {
  const started = Date.now();
  let last;
  let blocked = 0;
  for (;;) {
    const { status, body } = await pageApi(page, "/backend-api/conversation/" + conversationId).catch((error) => {
      if (BROWSER_GONE.test(error.message)) throw new TransportError("pending", "the browser went away while ChatGPT was answering; the answer continues on ChatGPT, recover it");
      return { status: 0 };
    });
    if (status === 401) throw new TransportError("pending", "the ChatGPT session expired while waiting; sign in (login), then recover");
    // A bot check answers the API with a 403 page instead of JSON. Waiting cannot clear it,
    // and the answer keeps going on ChatGPT's side: stop now and let a person clear the check.
    blocked = status === 403 && body === null ? blocked + 1 : 0;
    if (blocked >= 3) throw new TransportError("challenge", "chatgpt.com started a browser check (Cloudflare) while waiting for conversation " + conversationId + ". The answer continues on ChatGPT: run `chatgpt-transport.mjs login`, let the check pass, quit that window, then recover this session.");
    if (status === 200) {
      const answer = latestAnswer(body);
      if (onProgress && answer.status !== last) { last = answer.status; onProgress(answer); }
      if (answer.done) return answer;
      if (answer.failed) throw new TransportError("answer_failed", "ChatGPT ended the answer with status " + answer.status + " (" + answer.text.length + " characters); it is not a complete report", { status: answer.status });
    }
    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) throw new TransportError("pending", "no final answer after " + Math.round(timeoutMs / 60000) + " min in conversation " + conversationId + "; recover it later");
    await pause(Math.min(elapsed < 60000 ? fastMs : slowMs, timeoutMs - elapsed));
  }
}

// ---------------------------------------------------------------------------
// Sessions: one directory per submission under <home>/sessions, written at every
// stage so a dead CLI can always be recovered without resubmitting.

export class TransportError extends Error {
  constructor(code, message, details) { super("pro-review transport: " + message); this.code = code; this.details = details; }
}

export const SESSION_ID = /^[a-z0-9][a-z0-9-]{2,80}$/;
export function newSessionId(slug = "pro-review") {
  const base = String(slug).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "pro-review";
  return base + "-" + randomBytes(3).toString("hex");
}
export function sessionDir(home, id) {
  if (!SESSION_ID.test(id)) throw new TransportError("usage", "session ids are lowercase letters, digits and dashes: " + id);
  return join(home, "sessions", id);
}
export function readSession(home, id) {
  try { return JSON.parse(readFileSync(join(sessionDir(home, id), "meta.json"), "utf8")); } catch { return undefined; }
}
export function writeSession(home, meta) {
  const dir = sessionDir(home, meta.id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = join(dir, ".meta-" + randomBytes(4).toString("hex") + ".tmp");
  writeFileSync(temp, JSON.stringify({ ...meta, updatedAt: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
  renameSync(temp, join(dir, "meta.json"));
}

async function openChatGpt({ profile, window = "background", url = CHATGPT_URL, inputTimeoutMs }) {
  // "background" (default): never activates Chrome, never shows a window, never switches
  // Spaces. "front": a visible window a person must act in (--keep-browser).
  const background = window !== "front";
  const chrome = await obtainChrome({ profile, hidden: background });
  const cdp = await Cdp.connect(chrome);
  let page;
  try {
    page = await Page.open(cdp, url, { background });
    const state = await waitForComposer(page, inputTimeoutMs);
    if (!state.signedIn) throw new TransportError("needs_login", "the Pro profile is not signed in to ChatGPT; run `chatgpt-transport.mjs login`, sign in in that window, quit it, then retry. Nothing was sent.");
    return { chrome, cdp, page, account: state };
  } catch (error) {
    await closeChatGpt({ chrome, cdp, page, keepBrowser: false });
    throw error;
  }
}
/** Wait (bounded) for a headless browser to exit, then end any helper left in its process group. */
async function reapGroup(pid) {
  const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
  for (let waited = 0; alive() && waited < 10000; waited += 250) await pause(250);
  try { process.kill(-pid, "SIGTERM"); } catch { /* the group is already empty */ }
}

export const isBlankTarget = (url) => url === "about:blank" || url === "" || /^chrome:\/\//.test(url ?? "");

async function closeChatGpt({ chrome, cdp, page, keepBrowser }) {
  try {
    if (keepBrowser) return;
    if (page) await page.close();
    // A headless Chrome on this profile is always a background run's (nobody can use it),
    // so whichever run finishes last closes it, launched or reused. A windowed Chrome is
    // closed only by the run that launched it.
    // New headless mode reports a plain "Chrome/x" product; only its user agent says HeadlessChrome.
    const version = await cdp.send("Browser.getVersion", {}, undefined, 10000).catch(() => ({}));
    const headless = /Headless/i.test((version.product ?? "") + " " + (version.userAgent ?? ""));
    if (chrome?.launched || headless) {
      // Another run, or a person, may have opened a tab in this Chrome since: the
      // browser is closed only when nothing but blank tabs remains.
      const { targetInfos = [] } = await cdp.send("Target.getTargets", {}, undefined, 10000).catch(() => ({}));
      // about:blank and chrome:// pages (headless Chrome opens with chrome://newtab) are not anyone's work.
      const others = targetInfos.filter((target) => target.type === "page" && !isBlankTarget(target.url) && target.targetId !== page?.targetId);
      if (others.length === 0) {
        await cdp.send("Browser.close", {}, undefined, 10000).catch(() => {});
        // Headless Chrome can leave helper processes (network service, renderer) running
        // after the browser exits. Chrome was spawned detached, so it leads its own process
        // group: once it is gone, end whatever is left in that group. Nothing in a headless
        // group has a window a person could be using.
        if (headless && chrome?.pid) await reapGroup(chrome.pid);
      }
    }
  } finally {
    cdp?.close();
  }
}

/** Report the live model and effort; optionally switch to GPT-6 Pro. Sends nothing. */
export async function checkPro({ profile, select = false, window = "background", inputTimeoutMs = 60000 }) {
  const session = await openChatGpt({ profile, window, inputTimeoutMs });
  try {
    const result = await ensurePro(session.page, { select });
    return { ...result, plan: session.account.plan };
  } finally {
    await closeChatGpt({ ...session, keepBrowser: false });
  }
}

/**
 * Submit one prompt in a new chat and wait for the finished answer. Pro is proven
 * twice: the picker reads exact GPT-6 Pro right before send (otherwise nothing is
 * sent), and the server's own record of the answering model is returned for the
 * caller to require. Every stage is saved so `recover` can finish a dead run.
 */
export async function runReview({ home, profile, prompt, files = [], slug, sessionId = newSessionId(slug), timeoutMs = 20 * 60000,
  inputTimeoutMs = 5 * 60000, window = "background", keepBrowser = false, tag, log = () => {} }) {
  const meta = { id: sessionId, transport: TRANSPORT_ID, createdAt: new Date().toISOString(), status: "starting", tag,
    promptSha256: createHash("sha256").update(prompt).digest("hex"), normPromptSha256: createHash("sha256").update(compactText(prompt)).digest("hex"),
    promptChars: prompt.length, promptBytes: Buffer.byteLength(prompt, "utf8"),
    uploads: files.map((file) => ({ name: basename(file), sha256: createHash("sha256").update(readFileSync(file)).digest("hex") })) };
  writeSession(home, meta);
  log("session " + sessionId + " (recover with: recover --session " + sessionId + ")");
  const session = await openChatGpt({ profile, window, inputTimeoutMs }).catch((error) => {
    writeSession(home, { ...meta, status: "failed", error: error.message, submitted: false });
    throw error;
  });
  try {
    const { page } = session;
    const gate = async (stage) => {
      const pro = await ensurePro(page, { select: true });
      if (!pro.ok) throw new TransportError("not_pro", proFailure(stage, pro), pro.evidence);
      return pro;
    };
    await gate("before typing");
    const typed = await typePrompt(page, prompt);
    log("prompt in composer as " + typed.mode + " (" + typed.bytes + " bytes)");
    await attachFiles(page, files, inputTimeoutMs);
    if (files.length > 0) log("uploaded: " + meta.uploads.map((file) => file.name + " (sha256 " + file.sha256.slice(0, 12) + ")").join(", "));
    const preSubmit = await gate("right before send");
    log("pre-submit picker: " + preSubmit.label + " (" + preSubmit.status + ")");
    Object.assign(meta, { status: "submitting", preSubmit, plan: session.account.plan, sentAs: typed.mode });
    writeSession(home, meta);
    const conversationId = await submit(page, inputTimeoutMs, () => {
      Object.assign(meta, { status: "sent", submitted: true, sentAt: new Date().toISOString() });
      writeSession(home, meta);
    }, async () => await composerHolds(page, prompt, typed.mode) && await tilesHold(page, files));
    Object.assign(meta, { status: "submitted", submitted: true, conversationId, conversationUrl: CHATGPT_URL + "c/" + conversationId });
    writeSession(home, meta);
    log("submitted: " + meta.conversationUrl);
    const answer = await waitForAnswer(page, conversationId, { timeoutMs, onProgress: (a) => a.status && log("answer status: " + a.status) });
    const server = serverEvidence(answer, prompt, meta.uploads, undefined, await digestsFor(page, conversationId, answer));
    const outputs = await collectRunOutputs(page, conversationId, answer, log);
    Object.assign(meta, { status: "answered", server, answerChars: answer.text.length, messageId: answer.messageId, outputs: outputs.map(({ bytes, ...rest }) => rest) });
    writeSession(home, meta);
    return { sessionId, conversationId, text: answer.text, preSubmit, server, outputs };
  } catch (error) {
    const submitted = meta.submitted === true;
    writeSession(home, { ...meta, status: submitted ? "pending" : "failed", error: error.message, submitted });
    if (submitted && !(error instanceof TransportError)) error.code = "pending";
    throw error;
  } finally {
    await closeChatGpt({ ...session, keepBrowser });
  }
}

/** Read the conversation once more and download every file Pro created in this exchange. */
async function collectRunOutputs(page, conversationId, answer, log) {
  const { status, body } = await pageApi(page, "/backend-api/conversation/" + conversationId).catch(() => ({ status: 0 }));
  if (status !== 200) { log("could not re-read the conversation for output files"); return []; }
  const outputs = await collectOutputs(page, conversationId, body, answer.text);
  for (const item of outputs) log("output " + item.name + ": " + (item.error ? item.error : item.bytes.length + " bytes"));
  return outputs;
}

/**
 * A send whose new conversation id was never captured: find it among the conversations
 * created since the send whose first user turn is exactly this session's prompt.
 */
export async function findConversation(page, meta, limit = 20) {
  const since = Date.parse(meta.sentAt ?? meta.updatedAt ?? meta.createdAt) / 1000 - 120;
  const { status, body } = await pageApi(page, "/backend-api/conversations?offset=0&limit=" + limit + "&order=updated");
  if (status !== 200) return undefined;
  for (const item of body?.items ?? []) {
    const created = typeof item.create_time === "number" ? item.create_time : Date.parse(item.create_time) / 1000;
    if (!(created >= since) || typeof item.id !== "string") continue;
    const conversation = await pageApi(page, "/backend-api/conversation/" + item.id);
    if (conversation.status !== 200) continue;
    const turn = latestAnswer(conversation.body);
    if (serverEvidence(turn, undefined, undefined, meta, await digestsFor(page, item.id, turn)).promptVerified) return item.id;
  }
  return undefined;
}

/** Finish a submitted session from ChatGPT's own record. Never sends anything. */
export async function recoverReview({ home, profile, sessionId, timeoutMs = 60000, window = "background", inputTimeoutMs = 60000 }) {
  const meta = readSession(home, sessionId);
  if (!meta || meta.transport !== TRANSPORT_ID) throw new TransportError("usage", "no session " + sessionId + " from this transport under " + home);
  if (!meta.conversationId && meta.submitted !== true) throw new TransportError("not_submitted", "session " + sessionId + " never reached ChatGPT (status " + meta.status + "); nothing to recover, plan a new run");
  const session = await openChatGpt({ profile, window, inputTimeoutMs, url: meta.conversationUrl ?? CHATGPT_URL });
  try {
    if (!meta.conversationId) {
      const found = await findConversation(session.page, meta);
      if (!found) throw new TransportError("pending", "session " + sessionId + " was sent but its conversation is not visible yet; recover again shortly (nothing is resubmitted)");
      Object.assign(meta, { conversationId: found, conversationUrl: CHATGPT_URL + "c/" + found });
      writeSession(home, meta);
    }
    const answer = await waitForAnswer(session.page, meta.conversationId, { timeoutMs });
    const server = serverEvidence(answer, undefined, undefined, meta, await digestsFor(session.page, meta.conversationId, answer));
    const outputs = await collectRunOutputs(session.page, meta.conversationId, answer, () => {});
    writeSession(home, { ...meta, status: "answered", server, answerChars: answer.text.length, messageId: answer.messageId, outputs: outputs.map(({ bytes, ...rest }) => rest) });
    return { sessionId, conversationId: meta.conversationId, text: answer.text, preSubmit: meta.preSubmit, server, outputs };
  } finally {
    await closeChatGpt({ ...session, keepBrowser: false });
  }
}

export const TRANSPORT_ID = "omo-chatgpt-transport-1";
export const DEFAULT_HOME = join(os.homedir(), ".pro-review");
export const LEGACY_HOME = join(os.homedir(), ".oracle");
/** ~/.pro-review, or the legacy ~/.oracle while it has not been moved yet. Shared by the engine and this CLI. */
export function transportHome(home = DEFAULT_HOME, legacy = LEGACY_HOME) {
  return !existsSync(home) && existsSync(legacy) ? legacy : home;
}

// ---------------------------------------------------------------------------
// CLI: login | check [--select] | status. Submitting goes through pro-engine.mjs,
// which owns scope, hashing and publication.
async function main(argv) {
  const [command, ...rest] = argv;
  const home = transportHome();
  const profile = join(home, "browser-profile");
  const window = "background";
  try {
    if (command === "login") {
      const launched = launchForSignIn({ profile });
      console.log("A plain browser window (" + basename(chromePath()) + ", pid " + launched.pid + ") opened on the Pro profile at the ChatGPT login page. Sign in there, then quit it (Cmd+Q).");
      return 0;
    }
    if (command === "check") {
      const result = await checkPro({ profile, select: rest.includes("--select"), window });
      // One line by default (cheap for an agent to read); --json for the full evidence.
      if (rest.includes("--json")) console.log(JSON.stringify(result, null, 2));
      else console.log(JSON.stringify({ ok: result.ok, model: result.evidence.afterSelect?.model ?? result.evidence.observed.model,
        effort: result.evidence.afterSelect?.effortStep?.status ?? result.evidence.observed.effortStep?.status ?? null, status: result.status, plan: result.plan }));
      console.error(result.ok ? "PRO OK: " + result.label + " (" + result.status + ", plan " + result.plan + ")"
        : "NOT PRO: picker shows " + JSON.stringify(result.label) + "; rerun with --select to switch, or set GPT-6 Pro by hand");
      return result.ok ? 0 : 3;
    }
    if (command === "status") {
      const id = rest[0];
      const meta = id ? readSession(home, id) : undefined;
      if (!meta) { console.error("usage: chatgpt-transport.mjs status <session id>"); return 2; }
      console.log(JSON.stringify(meta, null, 2));
      return 0;
    }
    console.error("usage: chatgpt-transport.mjs login | check [--select] [--json] | status <session id>");
    return 2;
  } catch (error) {
    console.error(error.message);
    return error.code === "needs_login" || error.code === "challenge" ? 5 : error.code === "not_pro" ? 3 : 1;
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
