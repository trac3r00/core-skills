# Driving Aside directly

Use Aside's REPL from the eval js kernel when OmO itself needs to read or act in the user's open
Aside tabs, for example to check a page the user has open. OmO drives it; no Aside chat and no Aside
model is involved. If `doctor()` returns a state other than `"ready"`, relay its `remedy` field and
stop. One-off steps also work from a shell: `node <skill-root>/scripts/aside.mjs doctor | api | run
"<code>" [--images-dir <dir>]`.

```js
const { connectAside, doctor } = await import("<skill-root>/scripts/aside.mjs")
console.log(await doctor())                 // state: "ready"
const aside = await connectAside()          // keep it across cells; every call also carries the `omo` helpers
await aside.run(`{ const t = await listBrowserTabs(); console.log(JSON.stringify(t.map(x => ({ id: x.targetId, title: x.title, url: x.url })))) }`)
await aside.run(`{ await attachBrowserTab('<targetId>'); const s = await snapshot(page, { interactive: true }); console.log(s.tree) }`)
await aside.run(`{ await page.locator('e3').click(); console.log((await snapshot(page)).diff) }`)
const shot = await aside.run(`{ display(await page.screenshot()) }`, { imagesDir: "/tmp/aside-shots" })   // shot.imagePaths
aside.close()
```

- Only `console.log` output comes back. Wrap each step in `{ ... }` so names can be reused.
- Refs (`e1`, `e2`, ...) come from `snapshot(page, { interactive: true })` and are only valid until the
  next snapshot or navigation.
- `aside.api` holds the live REPL reference from Aside (`openTab`, `closeTab`, `fetch` with the
  user's cookies, `page.pdf`, `annotatedScreenshot`, and the `aside` global for chats and routines).
- Close tabs you opened. Never close or navigate a tab the user is using unless they asked. Tabs you
  open belong to your REPL session and close when it ends.
- One `connectAside()` connection runs its calls one at a time: a quick call waits behind a long
  one on the same connection (measured: 9 s behind a 10 s call). Separate connections run in
  parallel, and a call abandoned on a closed connection doesn't block them (measured: 30-40 ms). So
  keep each call short, and poll from a second connection if one call has to wait a long time.
- A hash-only navigation inside one page never fires `load`, so `page.goto()` to it waits out Aside's
  120 s cap. Open the URL with `openTab()` instead.

### The `omo` helpers (fast, trusted input)

`connectAside()` sends [`scripts/repl-helpers.js`](../scripts/repl-helpers.js) with every call, so the
`omo` global is always there, including after Aside resets the REPL scope (it does when your session
closes its last tab). `connectAside({ helpers: false })` turns that off. Each `run()` result carries
`{ ok, text, images, ms }`.

Aside's `page` is only partly Playwright: no `press`, `type`, `hover`, `check`, `selectOption`,
`setInputFiles`, `waitForFunction`, `waitForNavigation` or `waitForResponse`; `waitForURL` works only
with an exact URL string; `page.on('response')` delivers nothing. Its locator actions wait for
animation frames, about 1.5-2 s per click. `openTab()` and a `goto()` without `waitUntil` wait until
a page "looks interactive": 1.5-5 s, and 30 s on a page without controls. The helpers avoid all of
that: they read the element's box once and send real pointer and keyboard input (`isTrusted`) at its
centre, and `omo.open` loads pages with an explicit `waitUntil`.

```js
await aside.run(`{ const t1 = await omo.open('https://en.wikipedia.org/wiki/Web_browser')
  await omo.fill(t1, await omo.ref(t1, /(textbox|combobox) "Search/), 'Chromium', { submit: true })
  console.log(await omo.waitForUrl(t1, '/wiki/Chromium')); await omo.close(t1) }`)
```

A target is a snapshot ref (`e12`, or `f1e3` inside an iframe), a CSS selector, `text=<visible
text>` (resolved through the snapshot, so it reaches open shadow roots and cross-origin frames), or a
Locator. Actions wait up to 5 s for the target to appear, then throw `omo: timed out ...`.

| Helper | Does |
|---|---|
| `omo.open(url, { waitUntil })` | new tab loaded to `load` (or `domcontentloaded`, `commit`) in tens of ms after the page arrives |
| `omo.find(tab, 'text' \| /re/)` / `omo.ref(tab, text)` | matching snapshot lines with refs / the first ref, waiting for it |
| `omo.read(tab, { maxChars, offset })` | the snapshot in pages |
| `omo.click(tab, target, { count })` / `omo.hover(tab, target)` | trusted click / pointer move at the element's centre |
| `omo.fill(tab, target, value, { submit })` | trusted click, select the old value, type over it; `submit` presses Enter |
| `omo.type(tab, text, { perKey })` / `omo.press(tab, key, target?)` | type at the focus / press a key or chord (`Control+K`) |
| `omo.select(tab, target, labelOrValue)` / `omo.check(tab, target, on)` | pick an option / set a checkbox |
| `omo.upload(tab, target, { name, content } \| path)` | set a file input |
| `omo.drag(tab, from, to)` | HTML5 drag and drop |
| `omo.dialogs(tab, 'accept' \| 'dismiss', promptText)` | answer alert/confirm/prompt |
| `omo.popup(() => omo.click(tab, target), { match })` | the tab the page opens (target=_blank, window.open), attached |
| `omo.close(tab)` | close a tab (popups included) and wait until the browser no longer lists it |
| `omo.back(tab)` / `omo.forward(tab)` | history navigation; returns the new URL |
| `omo.waitForUrl(tab, match)` / `omo.waitForText(tab, text)` / `omo.waitUntil(fn)` | substring, glob, RegExp or predicate; visible text; any condition |
| `omo.scrollUntil(tab, fn)` | wheel-scroll until `fn()` holds (infinite feeds) |
| `omo.shot(tab, { target, fullPage })` | JPEG of the viewport, or PNG of one element; shown with `display()` |
| `omo.pdf(tab)` / `omo.download(tab, target)` | PDF / a link's file, saved under the REPL's `pwd` |
| `omo.requests(tab, { match })` / `omo.response(tab, match)` / `omo.json(url)` | what the page fetched / that JSON body again, with the user's cookies |
| `omo.tabs()` | open tabs, one line each |

Close tabs with `omo.close`, not `closeTab`: a popup that Aside adopted stays open after `closeTab`.
