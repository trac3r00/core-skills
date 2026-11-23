// The `omo` global for Aside's REPL. aside.mjs prepends this file to every run() call, so the
// helpers survive Aside resetting the REPL scope (it does when a session closes its last tab); the
// version guard makes the repeat a no-op. Runs inside Aside's sandbox: no import/require, only the
// REPL globals (snapshot, sleep, fetch, fs, path, pwd, display, listBrowserTabs, ...).
//
// Speed: Aside's locator actions wait for animation frames (about 1.5-2 s each, longer in a
// background tab). Pointer and keyboard helpers here resolve the element's box once and send real
// input at its centre, which is trusted input (event.isTrusted) and takes tens of milliseconds.
if (globalThis.omo?.version !== 2) {
  const isRegExp = (value) => Object.prototype.toString.call(value) === "[object RegExp]"
  const globToRegExp = (glob) =>
    new RegExp(
      "^" +
        glob
          .split("**")
          .map((part) => part.split("*").map((text) => text.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")).join("[^/]*"))
          .join(".*") +
        "$",
    )
  // string without * = substring, string with * = glob, RegExp, or (url) => boolean
  const urlMatcher = (match) => {
    if (typeof match === "function") return match
    if (isRegExp(match)) return (url) => new RegExp(match.source, match.flags.replace("g", "")).test(url)
    if (match.includes("*")) {
      const pattern = globToRegExp(match)
      return (url) => pattern.test(url)
    }
    return (url) => url.includes(match)
  }

  // Bounded condition wait. Aside's page emits no navigation or network events to subscribe to,
  // so the state is re-read on a short interval until it holds or the budget runs out.
  const waitUntil = async (check, { timeoutMs = 15_000, intervalMs = 50, what = "condition" } = {}) => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const value = await check()
      if (value) return value
      if (Date.now() >= deadline) throw new Error("omo: timed out after " + timeoutMs + " ms waiting for " + what)
      await sleep(intervalMs)
    }
  }

  const findLines = async (tab, pattern, interactive = true) => {
    const { tree: outline } = await snapshot(tab, { interactive })
    const test = isRegExp(pattern) ? (line) => pattern.test(line) : (line) => line.toLowerCase().includes(String(pattern).toLowerCase())
    return outline.split("\n").filter(test)
  }
  const refOf = (line) => line.match(/\[ref=(f?\d*e\d+)\]/)?.[1]
  // First ref whose line matches; exact `"text"` matches win over substring matches.
  const findRef = async (tab, text) => {
    const lines = (await findLines(tab, text)).filter(refOf)
    const exact = typeof text === "string" && lines.find((line) => line.includes('"' + text + '"'))
    return lines.length ? refOf(exact || lines[0]) : null
  }

  // A target is a snapshot ref (e12, f1e3), a CSS selector, `text=<visible text>`, or a Locator.
  // Resolves to { locator, ref }; `ref` is the snapshot ref when there is one (frame offsets need it).
  const locate = async (tab, target, timeoutMs = 5_000) => {
    if (typeof target !== "string") return { locator: target, ref: "" }
    if (target.startsWith("text=")) {
      const text = target.slice(5)
      const ref = await waitUntil(() => findRef(tab, text), { timeoutMs, what: "text " + JSON.stringify(text) })
      return { locator: tab.locator(ref), ref }
    }
    const locator = tab.locator(target)
    await waitUntil(async () => (await locator.count()) > 0, { timeoutMs, what: "element " + target })
    return { locator, ref: target }
  }
  const locator = async (tab, target, timeoutMs) => (await locate(tab, target, timeoutMs)).locator
  const pointAt = async (tab, target, timeoutMs) => {
    const { locator: found, ref } = await locate(tab, target, timeoutMs)
    return centre(tab, found, ref || String(target))
  }
  // Aside reports boxes of frame refs (f<N>e<M>) relative to their frame, so the frame's own
  // position and border are added to reach page coordinates.
  const frameOffset = async (tab, what) => {
    const frame = /^f(\d+)e\d+$/.exec(what)
    if (!frame) return { x: 0, y: 0 }
    const iframe = tab.locator("iframe").nth(Number(frame[1]) - 1)
    const box = await iframe.boundingBox()
    const [left, top] = await iframe.evaluate((element) => [element.clientLeft, element.clientTop])
    return { x: box.x + left, y: box.y + top }
  }
  const centre = async (tab, locator, what) => {
    await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }))
    const box = await locator.boundingBox()
    if (!box || box.width === 0 || box.height === 0) throw new Error("omo: " + what + " has no visible box")
    const offset = await frameOffset(tab, what)
    const page = { x: box.x + offset.x, y: box.y + offset.y, width: box.width, height: box.height }
    return { x: page.x + page.width / 2, y: page.y + page.height / 2, box: page }
  }
  // openTab() waits until a page "looks interactive", which costs 1.5-5 s and never ends on a page
  // without controls. A tab opened on a one-button stub is ready at once; goto() with an explicit
  // waitUntil then loads the real page in tens of milliseconds.
  const STUB = "data:text/html,<title>omo</title><button>omo</button>"
  const tabIds = async () => new Set((await listBrowserTabs()).map((tab) => tab.targetId))
  // Tabs the page opened itself (target=_blank, window.open). Aside adopts them into the session,
  // and closeTab() on an attached handle leaves them open; window.close() from inside works.
  const popups = new WeakSet()

  const omo = {
    version: 2,
    waitUntil,

    /** Snapshot lines matching `pattern` (case-insensitive string or RegExp), each with its ref. */
    find: async (tab, pattern, { interactive = true, limit = 40 } = {}) => {
      const lines = await findLines(tab, pattern, interactive)
      const shown = lines.slice(0, limit).map((line) => line.trim())
      return lines.length > limit ? shown.concat("# omo: " + (lines.length - limit) + " more matches; raise limit or narrow the pattern").join("\n") : shown.join("\n")
    },

    /** The ref of the first element whose snapshot line matches; waits for it to appear. */
    ref: (tab, text, { timeoutMs = 5_000 } = {}) => waitUntil(() => findRef(tab, text), { timeoutMs, what: "text " + String(text) }),

    /** The snapshot tree in pages of `maxChars`; the last line says how to read the rest. */
    read: async (tab, { interactive = true, maxChars = 12_000, offset = 0 } = {}) => {
      const { tree: outline } = await snapshot(tab, { interactive })
      const slice = outline.slice(offset, offset + maxChars)
      const next = offset + slice.length
      return next < outline.length ? slice + "\n# omo: " + next + " of " + outline.length + " chars shown; read more with { offset: " + next + " } or narrow with omo.find()" : slice
    },

    /** Trusted click at the element's centre. `count` repeats it. */
    click: async (tab, target, { count = 1, button = "left", timeoutMs } = {}) => {
      const { x, y } = await pointAt(tab, target, timeoutMs)
      for (let i = 0; i < count; i++) await tab.mouse.click(x, y, { button })
    },

    /** Trusted pointer move onto the element (mouseenter/mouseover fire). */
    hover: async (tab, target, { timeoutMs } = {}) => {
      const { x, y } = await pointAt(tab, target, timeoutMs)
      await tab.mouse.move(x, y)
    },

    /** Focuses by trusted click, selects the current value, types `value`; `submit` presses Enter. */
    fill: async (tab, target, value, { submit = false, timeoutMs } = {}) => {
      const { x, y } = await pointAt(tab, target, timeoutMs)
      await tab.mouse.click(x, y)
      await (await locator(tab, target, timeoutMs)).evaluate((element) => {
        if (typeof element.select === "function") element.select()
        else window.getSelection().selectAllChildren(element)
      })
      await tab.keyboard.insertText(value)
      if (submit) await tab.keyboard.press("Enter")
    },

    /** Types at the focused element, key by key when `perKey` (for handlers that watch keydown). */
    type: async (tab, text, { perKey = false } = {}) => (perKey ? tab.keyboard.type(text) : tab.keyboard.insertText(text)),

    /** Presses a key or chord (`Control+K`) on `target` when given, else on the focused node. */
    press: async (tab, key, target) => {
      if (target !== undefined) await (await locator(tab, target)).evaluate((element) => element.focus())
      await tab.keyboard.press(key)
    },

    /** Picks an <option> by visible label or value; fires input and change. Returns the value. */
    select: async (tab, target, option, { timeoutMs } = {}) =>
      (await locator(tab, target, timeoutMs)).evaluate((element, wanted) => {
        const match = [...element.options].find((o) => o.label === wanted || o.textContent.trim() === wanted || o.value === wanted)
        if (!match) throw new Error("omo: no option " + JSON.stringify(wanted))
        element.value = match.value
        element.dispatchEvent(new Event("input", { bubbles: true }))
        element.dispatchEvent(new Event("change", { bubbles: true }))
        return match.value
      }, option),

    /** Sets a checkbox or radio to `on` with a trusted click, only if it is not already there. */
    check: async (tab, target, on = true, { timeoutMs } = {}) => {
      if ((await (await locator(tab, target, timeoutMs)).evaluate((element) => element.checked)) !== on) await omo.click(tab, target)
    },

    /** HTML5 drag and drop from one element onto another. */
    drag: async (tab, from, to) => (await locator(tab, from)).dragTo(await locator(tab, to)),

    /** Sets a file input from `{ name, content }` or a path; the file is written under the REPL's pwd. */
    upload: async (tab, target, file) => {
      let filePath = file
      if (typeof file === "object") {
        filePath = path.join(pwd, file.name)
        await fs.writeFile(filePath, file.content)
      }
      await (await locator(tab, target)).setInputFiles(filePath)
      return filePath
    },

    /** Answers every alert/confirm/prompt on the tab: "accept" (optionally with prompt text) or "dismiss". */
    dialogs: (tab, mode = "accept", promptText) => tab.on("dialog", (dialog) => (mode === "accept" ? dialog.accept(promptText) : dialog.dismiss())),

    /** Runs `action` (e.g. a click) and returns the tab it opens, attached. Close it with omo.close. */
    popup: async (action, { match, timeoutMs = 10_000 } = {}) => {
      const before = await tabIds()
      await action()
      const test = match === undefined ? () => true : urlMatcher(match)
      const opened = await waitUntil(async () => (await listBrowserTabs()).find((tab) => !before.has(tab.targetId) && test(tab.url)), { timeoutMs, what: "a new tab" })
      const tab = await attachBrowserTab(opened.targetId)
      popups.add(tab)
      return tab
    },

    /** Closes a tab and waits until the browser no longer lists it. */
    close: async (tab) => {
      const id = tab.targetId
      const gone = async () => !(await tabIds()).has(id)
      if (popups.has(tab)) {
        // evaluate() on an adopted popup sometimes stalls for 30 s, so it gets 1 s; closeTab() is the fallback.
        await Promise.race([tab.evaluate(() => void setTimeout(() => window.close(), 0)).catch(() => {}), sleep(1_000)])
        const closed = await waitUntil(gone, { timeoutMs: 1_000, what: "popup " + id + " to close" }).catch(() => false)
        if (!closed) await closeTab(tab)
      } else await closeTab(tab)
      if (id) await waitUntil(gone, { timeoutMs: 5_000, what: "tab " + id + " to close" })
    },

    /** Opens a URL in a new tab and returns it once `waitUntil` ("load", "domcontentloaded", "commit") is reached. */
    open: async (url, { waitUntil = "load", timeoutMs = 30_000 } = {}) => {
      const tab = await openTab(STUB)
      await tab.goto(url, { waitUntil, timeout: timeoutMs })
      return tab
    },

    /** history.back()/forward() and wait for the URL to change; returns the new URL. */
    back: async (tab, { timeoutMs } = {}) => {
      const from = tab.url()
      await tab.evaluate(() => history.back())
      return waitUntil(() => tab.url() !== from && tab.url(), { timeoutMs, what: "back navigation" })
    },
    forward: async (tab, { timeoutMs } = {}) => {
      const from = tab.url()
      await tab.evaluate(() => history.forward())
      return waitUntil(() => tab.url() !== from && tab.url(), { timeoutMs, what: "forward navigation" })
    },

    /** Waits until the tab's URL matches; returns the URL. */
    waitForUrl: (tab, match, options = {}) => {
      const test = urlMatcher(match)
      return waitUntil(() => (test(tab.url()) ? tab.url() : null), { what: "URL " + String(match), ...options })
    },

    /** Waits until the page's visible text contains `text` (string or RegExp). */
    waitForText: (tab, text, options = {}) =>
      waitUntil(
        async () => {
          const body = await tab.evaluate(() => document.body?.innerText ?? "")
          return isRegExp(text) ? text.test(body) : body.includes(text)
        },
        { what: "text " + String(text), ...options },
      ),

    /** Wheel-scrolls until `until()` is truthy (e.g. an item count); returns its value. */
    scrollUntil: (tab, until, { step = 3000, timeoutMs = 20_000 } = {}) =>
      waitUntil(
        async () => {
          const value = await until()
          if (!value) await tab.mouse.wheel(0, step)
          return value
        },
        { timeoutMs, intervalMs: 100, what: "scroll condition" },
      ),

    /** Screenshot of the viewport, the full page, or one element (`target`), shown with display(). */
    shot: async (tab, { target, fullPage = false, quality = 60, show = true } = {}) => {
      let bytes
      if (target !== undefined) {
        const { box } = await pointAt(tab, target)
        bytes = await tab.screenshot({ type: "png", clip: box })
      } else bytes = await tab.screenshot({ type: "jpeg", quality, fullPage })
      if (show) display(bytes)
      return { kb: Math.round(bytes.length / 1024), bytes }
    },

    /** Saves the tab as PDF under pwd (or `file`); returns the path and size. */
    pdf: async (tab, { file = path.join(pwd, "page-" + Date.now() + ".pdf") } = {}) => {
      const bytes = await tab.pdf()
      await fs.writeFile(file, bytes)
      return { path: file, kb: Math.round(bytes.length / 1024) }
    },

    /** Downloads what a link points to, with the user's cookies, under pwd (or `file`). */
    download: async (tab, target, { file } = {}) => {
      const href = await (await locator(tab, target)).evaluate((element) => element.href)
      if (!href) throw new Error("omo: " + String(target) + " has no href to download")
      const response = await fetch(href)
      if (!response.ok) throw new Error("omo.download: HTTP " + response.status + " for " + href)
      const bytes = Buffer.from(await response.arrayBuffer())
      const name = response.headers.get("content-disposition")?.match(/filename="?([^";]+)/)?.[1] ?? href.split("/").pop().split("?")[0]
      const out = file ?? path.join(pwd, name || "download")
      await fs.writeFile(out, bytes)
      return { path: out, bytes }
    },

    /** Requests the page has made (Resource Timing: type, size, duration, URL; no bodies or status). */
    requests: async (tab, { match, limit = 40 } = {}) => {
      const entries = await tab.evaluate(() =>
        performance.getEntriesByType("resource").map((entry) => ({ type: entry.initiatorType, kb: Math.round((entry.transferSize || entry.encodedBodySize || 0) / 1024), ms: Math.round(entry.duration), url: entry.name })),
      )
      const test = match === undefined ? () => true : urlMatcher(match)
      return entries
        .filter((entry) => test(entry.url))
        .slice(-limit)
        .map((entry) => entry.type + "\t" + entry.kb + "kb\t" + entry.ms + "ms\t" + entry.url)
        .join("\n")
    },

    /** The JSON body of the latest request the page made whose URL matches, re-fetched with the user's cookies. */
    response: async (tab, match, { timeoutMs = 10_000 } = {}) => {
      const test = urlMatcher(match)
      const url = await waitUntil(
        async () => (await tab.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name))).filter(test).pop(),
        { timeoutMs, what: "a request matching " + String(match) },
      )
      return omo.json(url)
    },

    /** GET (or `init`) a URL with the user's cookies and parse JSON. Throws on a non-2xx status. */
    json: async (url, init) => {
      const response = await fetch(url, init)
      if (!response.ok) throw new Error("omo.json: HTTP " + response.status + " for " + url)
      return response.json()
    },

    /** Open browser tabs as compact lines: targetId, title, url. */
    tabs: async () => (await listBrowserTabs()).map((tab) => tab.targetId + "\t" + tab.title + "\t" + tab.url).join("\n"),
  }
  globalThis.omo = omo
}
