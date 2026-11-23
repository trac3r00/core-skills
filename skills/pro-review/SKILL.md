---
name: pro-review
description: "Explicit GPT-6 Pro second-opinion code review through our Pro-checked ChatGPT transport: machine-checked report, local verification. Use only as /pro-review or $pro-review. Not for routine self-review, lint, or tests."
version: 2.0.0
license: MIT
disable-model-invocation: true
metadata:
  agentskills:
    tags: [review, code-review, chatgpt-pro, second-opinion, verification]
---

# OmO Pro Review

Run this only when explicitly invoked as `/pro-review`, `$pro-review`, or
`/skill:pro-review`. It gets an independent GPT-6 Pro review, machine-checks the
returned report, and verifies every claim locally before reporting. It adds no
model, provider, or auth configuration, and it does not replace tests.

## 1. Scope the question

State the review question in one sentence. Use the user's target and its absolute
paths or globs. Without a target, review the current working changes plus their
callers and tests. If neither exists, ask what to review. Never hand the reviewer
the home directory, a whole workspace, or unrelated personal data as a guessed target.

Inspect the implementation yourself first, so you can brief the reviewer and judge
its answers. Scope the complete relevant set: full function bodies, callers, types,
tests, configuration. A diff alone is rarely enough. For a contained feature name
its whole module; for larger work trace dependencies and boundaries instead of
widening to the whole repository.

Standing invariant: the reviewer has no session, code, or project context, and no
access to the user's machine, repository, git history or GitHub. Everything it
judges must ride in the message:

- Every code pass uploads a zip of the scoped files (paths kept, so Pro's Python
  sandbox can unzip, search and run it) and also pastes them in full when they fit.
  Every prompt ends with an exact statement of what was sent and that nothing else
  is visible.
- If the scope lacks something the review needs, widen `--target` (a whole project
  directory is fine) instead of letting the reviewer assume.
- `pro-engine.mjs run --attach FILE` (repeatable) adds anything else the reviewer
  must see (screenshots, PDFs, Office files, CSVs, audio). Each file is checked,
  uploaded and hash-verified. Files Pro creates come back in `<report>.files/`.
- `pro-engine.mjs run --prompt-only --brief FILE --report FILE` is only for
  questions that need no code. Put all context in that brief (plus `--attach`);
  Pro is told exactly what is attached.
- When a gap cannot be closed, ask the open judgments as questions. Never phrase a
  brief or a finding as if the reviewer already knows the user's code or project.

The brief directs Pro to its Python sandbox on the zip (tree, search, tests,
reproductions) and forbids web search and plugins or connectors (GitHub, drives).
Before sending, make sure it tells the reviewer to use ChatGPT's own features
(images, canvases) when they clarify a finding. ChatGPT Skills (Business, Enterprise and Edu only) are not used.

## 2. Plan the handoff

`PRO_REVIEW_DIR` is this skill's own directory (for example
`~/.agents/skills/pro-review`). The scripts need Node.js 24+ and nothing else.

```sh
node "$PRO_REVIEW_DIR"/scripts/handoff.mjs plan \
  --repo "$PWD" --changes \
  --question "<the one-sentence question>" \
  --out "$PWD/.pro-review/<slug>"
```

For explicit paths, replace `--changes` with repeated `--target <path|glob>`; the
hazard rules still apply. `--budget <tokens>` forces a split of a scope too large
for one pass. The output directory must be new or empty; `--force` replaces only an
earlier handoff's own manifest and briefs, and refuses once that handoff has a report.
Planning rejects any `--engine`, `--client` or `--model` other than the Pro ones
(exit 2) instead of substituting a reviewer.

`plan` writes `manifest.json` and one `brief-pass<N>.md` per pass, and prints: files
with roles and token estimates, every exclusion with its reason, the git digest
(including deleted paths), the report path, and one nonce marker per pass. Read it
before sending anything. Check that the scope matches your intent, nothing essential
was excluded, the passes fit the reviewer's context, and the brief's constraints
state the standing invariant. The path policy filters path shapes only (secrets,
tokens, cookies, sessions, logs, generated and excluded directories, earlier
handoffs); it does not detect credentials pasted inside ordinary source files.

## 3. Send it to ChatGPT Pro

The Pro engine reaches the web-only GPT-6 Pro tier through our own zero-dependency
transport, `scripts/chatgpt-transport.mjs`; no Oracle code or package is used. Read
[The Pro engine](references/pro-engine.md) before the first live run.

**Check Pro first:**

```sh
node "$PRO_REVIEW_DIR"/scripts/chatgpt-transport.mjs check   # 0 = GPT-6 Pro, 3 = not Pro, 5 = a person is needed
```

On exit 3, rerun with `check --select` to switch to GPT-6 at Pro effort, or ask the
user to set it. Model and effort are locked to Pro: the run reads the picker right
before send (it switches to the Pro row once if needed, otherwise nothing is sent),
and ChatGPT's own record of the answer must name GPT-6 Pro (or GPT-6 at Pro effort)
before the reply is published. A non-Pro answer is never reported as a Pro review,
and no other model or engine is ever substituted.

**Sign-in and browser checks.** Exit 5 means the profile is signed out or chatgpt.com
shows a Cloudflare browser check. Run `chatgpt-transport.mjs login`, tell the user a
plain ChatGPT window opened for them to sign in (or let the check pass) and quit it
(Cmd+Q), then rerun. The transport never solves or bypasses a check itself.
The transport drives the user's default browser when it is Chromium-based (Chrome,
Brave, Edge, ...), on its own dedicated profile, never their everyday profile or its
cookies. It does not force Chrome. A non-Chromium default stops the run with nothing
sent; the user may set `PRO_REVIEW_BROWSER` to a Chromium executable. Never kill or
close a browser on that profile: a person may be signing in there, so ask them to quit it.

**Run:**

```sh
node "$PRO_REVIEW_DIR"/scripts/pro-engine.mjs run \
  --manifest "<manifest dir>/manifest.json"        # add --pass N for later passes
```

The run never takes the screen. It uses one background browser instance on the
dedicated profile, started headless: no visible window, no Dock icon, never
focused, no Spaces switch. Only `--keep-browser` and `login` show a window, because
a person acts there.

Start it through the background command monitor with a deadline longer than the
run's `--timeout` (default 45m). A Pro answer usually takes 10-15 minutes. Exit 0
means the report was published with both Pro proofs; the other exit codes are in
[The Pro engine](references/pro-engine.md#commands-and-exit-codes).

An explicit review invocation authorizes sending the scoped brief to this engine.
Installing the skill or reading this file does not request a live review. Stay
inside the user's existing credentials: never add API keys, copy another client's
auth, or switch a client's account.

### Optional: the workspace bridge

Only when the user asks for it, the reviewer can instead read the planned scope on
demand through `scripts/bridge.mjs`: a loopback MCP server for this handoff only,
reached from ChatGPT over OpenAI's Secure MCP Tunnel. Reading is read-only; the
reviewer files the report with `submit_report` (contract-checked) and may store
fixes with `propose_patch` as diffs that are never applied. It needs the user's
one-time tunnel and plugin setup, and its model choice is not attested: label such
a review "ChatGPT via bridge, model not attested". Read
[The workspace bridge](references/bridge.md) before using it.

## 4. Harvest the artifact, never the echo

Wait for the report file the brief named by watching that path. A marker echoed
from your own prompt is not an answer, and a fixed sleep is not a wait. Then run:

```sh
node "$PRO_REVIEW_DIR"/scripts/handoff.mjs verify \
  --report "<report path>" --manifest "<manifest path>" --format terminal
```

Exit 0 renders the summary (verdict, severity counts, findings with locations,
checks, limits). Exit 2 names exactly what the report is missing: reject it and ask
for a corrected report instead of summarising an incomplete answer.

`verify` checks a cooperating reviewer's report under a deliberately strict grammar
(exact headings, one findings table, no raw HTML, fences only at column 0) and fails
closed on anything else. It cannot catch a reviewer that omits its own findings, so
always read the report itself (step 5).

If the CLI dies after the send, or a run stalls, sits on an approval dialog, or
loses its transport, ChatGPT keeps generating. Recover the same session; never
submit the same brief again:

```sh
node "$PRO_REVIEW_DIR"/scripts/pro-engine.mjs recover \
  --session <id> --manifest "<manifest path>"      # id printed as "session <id>" at run start
```

It publishes under the same Pro proofs and exits 4 while the answer is still pending.
Ask the user only for what a human must do: a login, a browser check, an account
choice, an approval prompt, or a decision to abandon the run.

## 5. Verify and report

Read the report. Reproduce each proposed finding in the current code and run
focused checks where needed. Separate confirmed defects, plausible risks, and
unsupported claims; agreement between reviewers is not proof.

Return findings first, ordered by severity, with `path:line`, the failing condition,
impact, and a minimal correction. Say so when there are no confirmed findings.
Include unresolved questions, the reviewed scope, the checks actually run, the
engine used, the report path, and the model identity ChatGPT reported. The report
contract is [Report template](references/report-template.md); `verify --format json`
emits the machine-readable form.

Review-only requests end with the assessment: do not implement, commit, publish, or
contact people unless the user separately asks. For an existing authorized fix task,
use verified findings within that task's scope.

[Design and evidence](references/sources.md) explains what was verified and why a
client's self-reported model is not independent attestation.
