# Durable artifact sessions and recovery

Read when starting or resuming hosted work. `scripts/session.mjs` requires
Node.js 24+, uses only builtins, and makes **no network requests**. Run it from
its absolute skill path. It writes only to the explicit run directory; it does
not send prompts, manage browser credentials, update native todos or establish
remote exactly-once execution.

## Files and command contract

Keep one run directory for one design task:

```text
<run>/
  brief.md               # context, requirements and acceptance IDs
  progress.md            # native task labels, selection, decisions, next action
  session.json           # helper-owned ledger
  prompts/               # exact turn or direct-edit intent
  evidence/              # observations, screenshots, checks, download receipts
```

Do not store passwords, cookies, token-bearing frame URLs, full browser profiles,
or unrelated chat history. Persist only normal artifact/chat URLs. Resource
paths in this document are relative to the run directory unless stated otherwise.
Use host file-edit tools to write briefs, prompts and evidence receipts.

```sh
node "$DESIGN_SKILL/scripts/session.mjs" init \
  --run "$RUN" --brief "$RUN/brief.md" \
  --type design \
  --checks content-overview,layout-phone,layout-desktop,dialog-add,export-html
```

For an existing design, also pass `--artifact "https://claude.ai/artifact/<id>"`
and `--chat "https://claude.ai/chat/<id>"` when known.
`init` refuses an existing ledger. Use `status`, not `init --force`, to continue.
Check IDs must match the real brief; the example list is not a universal test set.
`--type` accepts `docs`, `slides`, `design`, or `dashboard` and is retained as
`artifactType` across restarts; omitted type defaults to `design`. Choose
type-specific checks from [artifact-types.md](artifact-types.md), not the Design
examples for every artifact. On older ledgers without a type, inspect the brief
and actual artifact before continuing.

```sh
node "$DESIGN_SKILL/scripts/session.mjs" status --run "$RUN"
```

JSON output includes the current `revision`, pending operation, artifact/chat
URLs, checks and `resumeAction`. Use the **returned revision** for the next
mutation, not a guessed constant. Every mutation increments it. Exit 0 means
the local operation succeeded; JSON errors on stderr exit 2.

Before creating or mutating hosted work:

```sh
node "$DESIGN_SKILL/scripts/session.mjs" begin \
  --run "$RUN" --expected-revision <current> \
  --kind create --prompt "$RUN/prompts/turn-01.md"
```

`kind` is `create`, `revise`, `comment`, `edit`, or `export`. A prompt file for
a direct edit/export describes its target and intended change; it need not be
a message sent to Claude. `create` means the initial template/chat creation
operation and cannot be used after an artifact is known.
For a template that creates an empty artifact, resolve that creation with its
URL, then begin `revise` before the first generation prompt.

`begin` records intent before the UI action. Save its returned
`pendingOperation.id`. No second `begin` is allowed while it is unresolved.
Non-export mutations invalidate check passes; exports do not. Keep one lead
writer per artifact even when there are several OmO agents.

After observing the operation's outcome, write an evidence receipt. It should
identify the operation, source URL, observed saved revision/time, target
selection, final response/permission state, files or screenshots, and any
uncertainty. Then:

```sh
node "$DESIGN_SKILL/scripts/session.mjs" resolve \
  --run "$RUN" --expected-revision <current> --operation <returned-id> \
  --evidence "$RUN/evidence/turn-01.json" \
  --artifact "https://claude.ai/artifact/<id>" \
  --chat "https://claude.ai/chat/<id>"
```

URLs can be omitted when already recorded. Ordinary
`https://claude.ai/code/artifact/<id>` links are also accepted. Never persist an
internal signed iframe URL or auth/query parameters.
Keep the same recorded artifact URL on later resolutions; changing identities
requires a new linked run. A renamed title does not require changing its URL.

Record each planned check after actually performing it:

```sh
node "$DESIGN_SKILL/scripts/session.mjs" check \
  --run "$RUN" --expected-revision <current> --id layout-phone \
  --status pass --evidence "$RUN/evidence/layout-phone.json"
```

Status is `pass`, `fail` or `blocked`. Evidence files must exist and be nonempty. For a visual
check, the receipt names the images actually viewed and their hashes, the
artifact revision/time, viewport/state and verdict; a receipt alone does not
prove visual correctness. Keep raw screenshots and files, not just a success
sentence.

```sh
node "$DESIGN_SKILL/scripts/session.mjs" complete \
  --run "$RUN" --expected-revision <current>
```

Completion requires an artifact URL, no pending operation, all planned checks
passed, and current brief/evidence hashes. The helper detects direct file drift;
it cannot detect a remote edit or a changed screenshot referenced inside an
unchanged receipt. The lead must verify those dependencies and current remote
state before calling it.

## Recover without duplicating a hosted action

| Observed state | Recovery |
| --- | --- |
| `reconcile-pending` | Open the saved artifact/chat; inspect the last operation's actual outcome before any new send |
| Prior response still running | Reattach its completion monitor or subscribe once; keep the operation pending |
| Response ended and intended change exists | Save fresh evidence and resolve the same operation ID |
| Evidence proves action never applied | Resolve with `--outcome not-applied` and that evidence; only then consider another `begin` |
| Transport ended, outcome unknown | Leave pending; do independent work and seek the needed observation/human action |
| No URL recorded after create | Inspect the existing task session, chat and artifact list for the operation; do not create another design just because the URL was lost |
| `revalidate` | Brief or recorded evidence changed; inspect differences and rerun affected checks |
| `complete` | Ready to finalize or already finalized: re-observe for remote drift, call `complete` if `completed` is false, otherwise return the verified result unless new work was requested |
| `continue` | Restore the native todo list and continue the next unfinished requirement |

`not-applied` is an explicit evidence claim, not a reset button for a timeout.
For a changed brief, use the next non-export `begin` to record the new brief hash
and invalidate old checks. If acceptance IDs themselves change, initialize a
new run that links the existing artifact and explicitly supersedes the old run;
preserve both histories and reconcile the native todos. Do not edit the helper's
JSON by hand to erase uncertainty or failures.

The helper uses an exclusive short-lived local lock and revision checks.
A held lock fails without waiting or deleting it. After a crash, first establish
that no writer still owns the run; only then remove that run's stale lock using
the host's permitted file tools. Never auto-break a lock or run two writers.

## Pause, return, and cleanup

Before login handoff, user pause or context rollover, save URLs, selections,
artifact type and type-specific resume details (section/slide/data source,
metric definitions and filters where applicable),
pending operation ID, child/monitor handles, acceptance status, decisions and
next action in `progress.md`. Browser refs/tokens are transient; obtain new ones.
Stop/release task-owned browser sessions with their documented API; do not close
a user's unrelated tabs or terminate a session a person is using to sign in.

Resume with:

```text
$claude-design resume <absolute run directory>
```

The agent reads this skill and ledger; there is no background daemon waiting
behind that invocation. The native goal/todo/monitor tools retain their own
semantics. Report a real human-only blocker rather than inventing a resumed
tool session or replaying the last prompt.
