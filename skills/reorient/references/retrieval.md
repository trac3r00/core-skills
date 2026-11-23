# Evidence retrieval

Use this as a source checklist, not a mandate to scan unrelated accounts.
Inspect available tool schemas and installed adapter documentation before use.
Resolve another skill's directory through the host catalog, not a machine-fixed
package-manager path.

## Source order

1. Existing journal and host-exposed identity-scoped OmO memory index/blocks.
2. Live request, current host session/goal/todos/children and workspace identity.
3. Canonical project intent and workflow documents.
4. Relevant session lineage and original messages/tool outcomes.
5. Git content/history and read-only forge records.
6. Evidence-driven expansion to resolve gaps or contradictory claims.

Order guides retrieval cost, not authority. A source has authority only for
the claims it can support. A test log proves its run, not all current behavior.

## OmO memory and active sessions

- The `memory` tool may be mutation-only. Its presence does not imply a search
  method. Use injected metadata, discoverable read/search resources or the
  host-provided bound root; never invent `memory.search` or a directory.
- Identity restrictions are real. Record access denial and continue elsewhere;
  do not change identity or search around the guard.
- Use live goal/task tools to distinguish pending, finished, cancelled and lost
  work. Saved transcript/todo state is a historical checkpoint, not live proof.
- OmO examples observed 2026-10-19: injected `senpi-memory:<AGENT_ID>` identifies
  the pinned memory context; exposed `PI_SESSION_ID`, `PI_SESSION_FILE`,
  `PI_SESSION_CWD` and `PI_GOAL_STORE_FILE` can locate this session's state.
  Inspect named fields only when exposed; do not dump environment values.
  `local://` artifacts are session-local evidence, not a general memory store.
  Discover MCP resources only through the host's resource interface and respect
  their identity/access scope.
- Consult the installed `coding-agent-sessions` skill for history; load its
  platform reference for OmO/Senpi. Use its finder, then raw evidence for claims.
  Include delegated children when checking whether work was already done.
- Correlate sessions through repository identity and concrete task IDs, not
  similar folder names alone. Exclude unrelated projects and explain ambiguity.
- Check linked artifacts when tool output was truncated. Missing artifacts are
  gaps, not successful results. Summarize decisions without private reasoning.
- Use Herdr/session-finder only if actual terminal/process inspection is needed
  and authorized; neither a stale transcript nor pane title proves live state.
- Reading active siblings never permits steering them: no task messages,
  terminal input, cancellation or process termination as recap work.

## Git

Run read-only commands in the selected repository. Useful probes:

```sh
git rev-parse --show-toplevel --git-common-dir
git rev-parse HEAD
git branch --show-current
git status --short --branch
git worktree list --porcelain
git rev-list --max-parents=0 HEAD
git diff --stat
git diff --cached --stat
git log -n 30 --date=iso-strict --format=fuller
```

These are starting probes, not evidence of a complete audit. Inspect relevant
diffs and untracked files with file tools, excluding secrets/generated bulk.
Discover upstream/remotes without copying embedded credentials. Read historical
files with the host's revision-aware reader or `git show` where needed. Follow
goal/decision lineage farther than the initial log page. Record shallow/missing
history. Do not fetch merely to make local remote-tracking refs look current.
Inspect the configured upstream and merge-base when available; absence is not
an error to repair. For the chosen journal path, `git log --all -1 -- <path>`
and sibling worktree files can reveal divergent copies; a latest timestamp alone
does not establish a canonical branch. Record unresolved divergence.

## PRs, issues, reviews and CI

Use configured read-only forge tools or an installed authenticated CLI. Verify
repository identity and current API/CLI fields before requesting them. Query
open records and relevant closed/merged predecessors; paginate within stated
scope. Inspect bodies, changes, review decisions and unresolved threads, CI
checks and their exact head SHA. Record API observation times.

Report missing authentication/network/API capabilities precisely. A cached PR
summary is historical. No PR discovered is different from a completed query
returning zero PRs. Do not write comments, resolve reviews or change records.

## Finite research and evidence quality

Build short query lanes from project aliases, former paths, issue/PR/session
IDs, components/errors and origin-goal wording. Track lanes and coverage.
Search once broadly enough to locate relevant work, read it, then expand only
where the goal audit needs it. Follow citations to originals; do not turn a
chain of summaries into corroboration. Record the observation that could
disprove a lesson or inference. Recheck live state at the end rather than
performing repeated full rediscovery.
