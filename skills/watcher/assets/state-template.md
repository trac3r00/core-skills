# Watcher ledger

One row per objective and discovered session. Reuse an existing project work
log or `.omo/handoff/current.md` when it already holds state; otherwise keep
this file at `.omo/watcher/state.md`. Never maintain two ledgers. Update a row
only when its state changes.

| Session | Where | State | Action | Evidence | PR | CI | Pending |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<id>` | `<cwd>` or `<runner>:<cwd>` | active / idle / blocked / stalled / failed / unattributed / orphaned / unknown / saved / archived | none / retried / resumed / answered / branched | command and observed result | `#12 <url>` | pass / fail / pending | `<approval>` or none |

## Decisions

- `<timestamp>` used `<choice>` because `<evidence>`; reversible by `<step>`.

## Pending approvals

- `<exact action and target>` - not performed. Completed `<independent work>`
  instead.

## External waits

- `<handle or PR>` resumes on `<event>`; completed `<other work>` meanwhile.

## Open gaps

- `<session>`: `<what remains and why>`.
