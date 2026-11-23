# The Pro engine (ChatGPT Pro)

This is the default engine. It reaches the **web-only ChatGPT Pro tier**, which has
no API, through our own browser transport, our report contract, and our two-stage
Pro proof. It is the only engine that can honestly claim a Pro review.

## Pieces

| piece | role |
| --- | --- |
| `scripts/pro-engine.mjs` | `plan` shows one run's shape; `run` sends a verified brief and publishes the reply only with Pro evidence; `recover` finishes a run whose CLI died |
| `scripts/chatgpt-transport.mjs` | our own zero-dependency transport (forked from Oracle's approach, no Oracle code): the default Chromium browser on a dedicated profile, over the DevTools protocol (Node 24's built-in WebSocket); `login`, `check`, `status` |
| `scripts/handoff.mjs` | scope, hashes, brief and report contract (unchanged by the transport) |

There is nothing to install: Node.js 24+ and a Chromium-based browser are the only
requirements. The transport uses the user's **default browser** (macOS LaunchServices, the
Windows https UserChoice, or `xdg-settings`) when it is Chromium-based (Chrome, Brave,
Edge, Vivaldi, ...); a non-Chromium default such as Safari or Firefox stops the run with
nothing sent. `PRO_REVIEW_BROWSER` (or the older `PRO_REVIEW_CHROME`) may name an
executable explicitly (absolute path). Google Chrome is used only when no default browser
can be determined at all. The launch
flags and the overall page flow were adapted from steipete/oracle (MIT); no Oracle code
or package is used at run time.

## Model and effort: checkable, Pro only

```sh
node "$PRO_REVIEW_DIR"/scripts/chatgpt-transport.mjs check            # read only: exit 0 Pro, 3 not Pro, 5 signed out
node "$PRO_REVIEW_DIR"/scripts/chatgpt-transport.mjs check --select   # switch the picker to GPT-6 Pro, then re-read it
# prints one line, e.g. {"ok":true,"model":"GPT-6","effort":"Pro, 5 of 5.","status":"already-selected","plan":"pro"}; --json for full evidence
```

ChatGPT's picker (October 2026) is one menu with two controls: model rows (`GPT-6`,
`GPT-5.6 Sol`, ...) and a five-step effort slider, **Instant, Medium, High, Extra High,
Pro**. `check` opens a new chat, opens the menu, reads the checked model row and the
slider's own status line (for example `Pro, 5 of 5.`), closes the menu, and prints JSON:
`ok`, `label` (`GPT-6 + Pro`), `status` (`already-selected` / `switched` / `not-pro`),
the plan, the model, the effort step, and every model row. It never types or sends.
`--select` checks the GPT-6 row, steps the slider right with the arrow keys until it
reads Pro (recording every label it passes), and re-reads the menu after reopening it.
The choice persists in the profile.

A review is published only when **both** proofs hold:

1. **Picker, before send.** `run` reads the picker before typing and again right before
   the send click. Only the GPT-6 row checked at effort `Pro` passes (or a legacy single
   button reading exactly `GPT-6 Pro`); Extra High, another model, or a generic `Pro` chip
   fails. If it is not Pro, the transport runs the `--select` steps once and re-reads;
   still not Pro means exit 3 with nothing sent.
2. **Server, after the answer.** The answer is read from ChatGPT's own conversation
   record (`/backend-api/conversation/<id>`, called inside the page so the access token
   never leaves the browser). The *answering* model's `model_slug` must be GPT-6 Pro
   (`gpt-6-pro`, `gpt-6.1-pro`, ...) or GPT-6 with effort `pro`; a *requested* Pro slug
   proves nothing and is ignored. Anything else: exit 3, the reply kept privately and
   never published as a Pro review.
3. **Integrity.** The same record's first user turn must be the approved prompt: typed
   text equal to it with only whitespace runs collapsed (word and line boundaries still
   count), or exactly one big paste whose stored copy, downloaded inside the page, has the
   prompt's exact SHA-256. Every upload (the zip) must be stored byte for byte as approved,
   by downloaded SHA-256, with no extra attachment. A session without
   these recorded hashes is never verified. Any mismatch is refused like a non-Pro answer.
   The composer is also re-checked right before the send click.

The session file records both: `preSubmit` (picker evidence with timestamps and the rows
seen) and `server` (`modelSlug`, `requestedModelSlug`, `effort`, `pro`).

## Sign-in (one time)

```sh
node "$PRO_REVIEW_DIR"/scripts/chatgpt-transport.mjs login
```

opens a **plain** window of the same default browser on the dedicated profile `~/.pro-review/browser-profile` at the
ChatGPT login page. Sign in there, then quit it (Cmd+Q). It has no DevTools port on
purpose: Google refuses to sign in to a browser that exposes remote debugging ("This
browser or app may not be secure"). Later runs reuse the sign-in. A run on a signed-out
profile stops before typing with exit 5.

**Key store, never mix.** Chrome encrypts a profile's cookies with either the macOS
Keychain or a mock key store, and silently discards every cookie it cannot decrypt (which
signs ChatGPT out). The transport keeps Oracle's rule: a profile with a
`.pro-review-native-keychain-v1` or `.oracle-native-keychain-v1` marker, or a brand-new
profile, uses the Keychain; every other existing profile keeps
`--use-mock-keychain --password-store=basic`. `login` and `run` use the same choice. Never
open the profile with a plain Chrome launch of your own.

## Window

A run never takes the screen. Background runs start Chrome **headless**
(`--headless=new`) on the dedicated profile: there is no window and no Dock icon, so macOS
has nothing to bring to the front and no reason to switch Spaces. Each page opens on
`about:blank`, gets a normal Chrome user agent and a desktop viewport, and only then
loads ChatGPT, so the site never sees "HeadlessChrome" (workers included). The DevTools
Runtime domain is never enabled (a known bot signal), and a Cloudflare check gets 45 s to
pass by itself before the run asks a person to clear it in `login`. It runs with focus emulation, so
trusted clicks, the paste and file uploads behave as in a visible window. Verified: two
`check` runs and a full review with five uploads ran while a sampler recorded the
frontmost app every 0.2 s with its pid; the review's Chrome never became frontmost.
(Launching a windowed Chrome with `open -g` was tried first and once came to the front.)
Only `--keep-browser` and the plain `login` window show a window, because a person has to
act there. `--offscreen` is accepted for compatibility and changes nothing.

A Chrome that already holds the profile is reused through its DevTools endpoint, never
killed. One without an endpoint (for example the plain `login` window) makes the run
refuse with nothing sent: ask the person to quit it.

## Upload integrity

`plan` records a SHA-256 for every scoped file. Before sending, `run` re-checks each
manifest entry (plain repository-relative path, canonical containment, the shared path
policy, regular file, unchanged hash). Every manifest pass uploads the verified scope as **one zip** (`<repo>-pass<N>.zip`,
paths relative to the trusted root). The zip is written without dependencies and with
fixed timestamps, so the same files always give the same SHA-256. It goes through the
composer's general file input (the other inputs accept only images), and the send waits
until its tile shows, no upload progress remains and Send is enabled. The zip is what
lets Pro work like a reviewer with the project in hand: its Python sandbox can unzip it,
list the tree, search across files and run tests or a reproduction.

Up to 600 KB, the same files are also **pasted in full**, so Pro reads every line in
context as well. Typing was unusable here: CDP `insertText` took 18 s for 30k characters
and stalled beyond 60k, while a paste lands 100k characters in under a second. ChatGPT
keeps a short paste as text and turns a long one into a "Pasted text" chip (a
`big_paste` attachment that Pro reads in full; a live test with random markers at the
start, middle and end of 150k characters came back exact). Larger passes, or passes with
a file that is not valid UTF-8, go zip-only, and the prompt tells Pro to read every file
from the zip.

Every prompt ends with **What you received (and nothing else)**: the zip's name, file
count and hash, whether the files are also pasted, and that Pro cannot see the user's
machine, the rest of the repository, git history, GitHub, any connected app or earlier
conversations, so missing context must become a question under `## Limits`. A
`--prompt-only` run says that nothing at all is attached. ChatGPT's record then has to
agree (see Integrity above): the pasted or typed prompt, and every upload, are
downloaded and hash-checked, with no extra attachment allowed. A stale draft (text or
chip) is cleared or refused before anything is sent.

## Any file ChatGPT takes: `--attach`

`--attach PATH` (repeatable, on manifest and `--prompt-only` runs) uploads a file as it is:
a screenshot, a PDF, a Word, Excel or PowerPoint file, a CSV, audio, a zip. Before Chrome
starts, each file is checked against OpenAI's upload limits:

| kind | extensions | limit |
| --- | --- | --- |
| image (seen directly) | png, jpg, jpeg, gif, webp | 20 MB |
| spreadsheet | csv, tsv, xlsx, xls | about 50 MB |
| presentation | pptx | 512 MB |
| document | pdf, docx, txt, md, rtf, html, json, xml, yaml | 512 MB |
| audio (paid plans) | wav, mp3, ogg, flac, aac, m4a, webm, mp4, pcm | 512 MB |
| archive | zip | 512 MB |
| any other file (opened in the sandbox) | | 512 MB |

The first bytes must match the extension (a renamed file is refused). Empty files, links,
secret-shaped paths, executables and disk images, two uploads with the same name, and more
than 10 uploads in one message (the scope zip counts) are refused with nothing sent. The
delivery note lists every upload with its kind, size and hash and says how to use it
(look at an image, read every slide, load a spreadsheet in Python, transcribe audio).
ChatGPT's stored copy of every upload is downloaded after the answer and must match by
SHA-256; images are stored unchanged. A live run with a PNG, PDF, DOCX and CSV came back
with the code hidden in each, including the one that existed only as image pixels.
ChatGPT renames a repeated upload name ("name(1).png"), and the upload check accepts that.
Uploads count toward ChatGPT's limit of 80 files every 3 hours.

## Results: the report and every file Pro made

The report is the final answer to the run's own first message. Files Pro creates in its
sandbox (a patch, a fixed file, a chart) are found from ChatGPT's own record: the save
receipts in its tool output, the `content_references` of type `file` on its answers (a
file saved to the user's Library, linked as `chatgpt.com/library?file_id=…`), generated
images, and `sandbox:` links. Each is fetched by its file id with the page's own session. They are downloaded and saved
beside the published report in `<report>.files/`, with a `MANIFEST.json` of names,
sources and SHA-256. Names are reduced to safe basenames and nothing is overwritten; a
link with no saved copy is listed as not downloadable. Files are saved only together with
a published, Pro-proven report. The brief tells Pro to save and link any file it makes.
The default wait is 45 minutes (Pro with sandbox tools can run long); `recover` finishes
anything longer, with the same proofs and file download.

## Sessions and recovery

Each run writes `~/.pro-review/sessions/<id>/meta.json` at every stage (`starting`,
`submitting`, `submitted` with the conversation URL, `answered`, `pending`, `failed`) and
prints `session <id>` at the start. If the CLI dies after the send, the answer keeps being
generated by ChatGPT:

```sh
node "$PRO_REVIEW_DIR"/scripts/pro-engine.mjs recover \
  --session "<id>" --manifest "<manifest dir>/manifest.json" [--pass N] [--timeout 5m]
```

reopens the conversation, reads the server record, and publishes under the same proofs.
The report is always the reply to the conversation's first user turn, so a later turn or
branch never replaces it. A send whose conversation id was not captured is found among
conversations created since the send whose first turn is exactly this prompt. Exit 4 means
not finished (or not visible) yet; run it again later. `recover` refuses a session that a
different brief started, one without a brief binding, and one that never reached ChatGPT.
It never resubmits.

## Commands and exit codes

```sh
node "$PRO_REVIEW_DIR"/scripts/pro-engine.mjs plan --manifest "<manifest dir>/manifest.json" [--pass 1]
node "$PRO_REVIEW_DIR"/scripts/pro-engine.mjs run  --manifest "<manifest dir>/manifest.json" [--pass 1] [--keep-browser] [--timeout 20m]
node "$PRO_REVIEW_DIR"/scripts/chatgpt-transport.mjs status "<session id>"
```

| exit | meaning |
| --- | --- |
| 0 | report published with both Pro proofs |
| 2 | refused before sending (scope, paths, existing report, profile held) |
| 3 | not Pro: nothing sent (picker), or reply kept unpublished (server) |
| 4 | sent, answer not finished, or the browser/session went away while waiting: `recover` later |
| 5 | a person is needed first: profile signed out, or a Cloudflare browser check; both are solved in the plain `login` window |
| 1 | transport failure, or ChatGPT ended the answer with an error or partial completion; the message says whether anything was sent |

The wait polls ChatGPT's record every 3 s for the first minute, then every 10 s, with one
request per poll (the in-page token is cached). Every DevTools call and in-page request has
its own deadline, so a stalled browser or network cannot outlive `--timeout` (1 s to 6 h).
A run closes its own tab. A windowed Chrome is closed only by the run that launched it; a
headless one (always a background run's) is closed by whichever run finishes last, once
only blank or `chrome://` tabs remain, and any helper process it leaves behind is ended
with its process group. A lost browser, an expired session, a
failed answer, or a Cloudflare check that starts mid-wait (three polls in a row answered
with a 403 page) ends the wait at once instead of at the deadline. Clear the check in the
`login` window, then `recover`: the answer keeps going on ChatGPT's side. If Pro cannot be selected
because its effort step is locked (the Pro usage limit), the refusal says so and lists
the steps the slider reached.

Run `run` through the background command monitor with a deadline longer than its
`--timeout` (default 45m), and wait for the report file rather than for console text.
A Pro answer usually takes 10-15 minutes.

## Evidence

On 2026-10-27 the transport was verified live on the signed-in Pro profile (plan `pro`):

- `check` read `GPT-6 + Instant (1 of 5)` (exit 3), and `check --select` stepped the slider
  Instant, Medium, High, Extra High, Pro and re-read `GPT-6 + Pro (5 of 5)`. A fresh launch
  read `already-selected`.
- `run --prompt-only` (session `pro-review-6969ec`) passed the picker gate, was sent, and
  ChatGPT recorded the answer as `model_slug: gpt-6-pro`. It was published with exit 0, and
  `recover` on the same session republished it. A session that never sent was refused
  (exit 2).
- An attachment upload (`bundle.txt`) became ready and enabled Send without being sent;
  attachments do not survive into the next chat's draft.

## Limits

The picker and the server's `model_slug` are ChatGPT's own statements, not an independent
attestation of the hardware that served the answer. If ChatGPT renames its picker rows or
moves the composer, the gate fails closed (exit 3 or a timeout, nothing sent). Update
`SELECTORS` / `PRO_LABEL` in `chatgpt-transport.mjs` after a live `check`, never by
loosening the server check.
