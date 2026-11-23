---
name: cleanup-worktrees
description: "Inventory Git worktrees and local branches, then remove only exact approved targets. Use for explicit worktree or branch cleanup. Not for PRs (finish-pr)."
version: 1.1.0
license: MIT
compatibility: "Instruction-only; requires Git and optionally the Herdr CLI. Read-only inventory is the default; every removal needs explicit approval for exact targets."
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [git, worktrees, branches, cleanup]
---

# Cleanup Worktrees

Inventory local worktrees and propose exact candidates without disturbing work.
Use for explicit local branch/worktree cleanup, including `~/.herdr/worktrees`.
This skill authorizes only skill instructions, never cleanup itself. Do not
continue cleanup automatically after another task such as finish-pr.

## Dependencies and invocation

Requires Git. When Herdr is present, load the `herdr` skill and use its
read-only workspace, pane, process, and agent discovery. Load the `git-master`
skill where available before any Git operation. Prefix every Git command and
example below with `GIT_MASTER=1` (for example, `GIT_MASTER=1 git ...`). In a checkout whose
`git config core.bare` is `true`, use `git --git-dir=.git --work-tree=.` in
place of plain `git` and never change `core.bare`; `worktree list` and
`status` from a bare-flagged root are otherwise misleading.
Git documentation: https://git-scm.com/docs/git-worktree and
https://git-scm.com/docs/git-branch. Verify installed Herdr syntax with
`herdr --help` and relevant group help; never probe mutating commands.

Invoke with `/skill:cleanup-worktrees` or `$cleanup-worktrees`. After changing
the skill file, reload skills using the host's supported reload command.
Maintenance trigger: recheck Git and Herdr syntax and representative scenarios
after host/tool upgrades or any change to removal procedure.

## 1. Establish scope and authoritative inventory

1. Determine whether the user explicitly requested cleanup. If not, stop after
   explaining that creation or use of this skill grants no deletion authority.
2. Establish the requested repository from the user's current checkout:
   `GIT_MASTER=1 git rev-parse --show-toplevel`,
   `GIT_MASTER=1 git rev-parse --git-common-dir`,
   `GIT_MASTER=1 git status --short --branch`, and
   `GIT_MASTER=1 git rev-parse HEAD`. Record absolute cwd, top-level path,
   common Git directory, current branch (including detached state), and HEAD.
3. Treat `GIT_MASTER=1 git worktree list --porcelain -z` as the authoritative
   registration inventory. Parse NUL-delimited records, including paths,
   branch refs, HEADs, detached state, and `locked`/`prunable` markers. Resolve
   the default/base branch and chosen integration ref from repository
   configuration and explicit user scope; do not guess from branch names.
4. For a requested multi-repository `~/.herdr/worktrees` cleanup, enumerate
   repository grouping directories and their checkout children read-only
   (the usual layout is `~/.herdr/worktrees/REPO/CHECKOUT`). Resolve each candidate and its Git
   top-level/common directory using Git; group only by verified common-dir.
   Never infer repository ownership from names or path layout. Keep unregistered
   directories in the report; do not treat them as Git worktrees.
   Also inventory local branches with `GIT_MASTER=1 git for-each-ref
   --format='%(refname) %(objectname) %(upstream)' refs/heads`. Include branches
   without a worktree as separate rows; the same merge and protection gates apply.
5. Record source repo status and inspect each candidate:
   `GIT_MASTER=1 git -C PATH status --porcelain=v1 --untracked-files=all`,
   staged and unstaged diffs (`diff --cached` and `diff`), and
   `GIT_MASTER=1 git -C PATH ls-files --others --ignored --exclude-standard`.
   Inspect submodule state (`GIT_MASTER=1 git submodule status --recursive`) and relevant
   submodule dirt. Ignored files can be valuable; identify and preserve them.
   If value is unknown, retain the target; never infer disposability from an
   ignore rule. Only user-confirmed reproducible/disposable files may be discarded.
   Check branch refs/upstreams, candidate tip, and whether any worktree holds
   the branch. Record symlinks and resolve their real destinations.
   Retain symlinked registration paths, failed resolutions, and any path whose
   canonical repository or approved-root containment cannot be established.
6. Inspect local Herdr state where available, read-only: `herdr worktree list
   --cwd PATH`, `herdr workspace list`, `herdr workspace get ID`, `herdr pane
   list`, `herdr pane process-info ID`, and `herdr agent list`. Use actual
   command help for flags and exact workspace IDs. A registered Herdr worktree
   removal closes its workspace and panes; confirm exact closure is authorized
   and no live shell, process, or agent remains. Idle does not mean abandoned.
   If Herdr is unavailable, ownership or liveness is unclear, retain the target.

## 2. Decide and report before mutation

Never propose removal unless its branch tip is verified merged into the chosen
integration ref with
`GIT_MASTER=1 git -C REPO merge-base --is-ancestor TIP INTEGRATION_REF`,
and there is no work to preserve. Deleted upstream, age, directory name, or
apparent inactivity alone is insufficient. Squash- or rebase-merged PRs may
not be ancestors: retain them and request a separate explicit decision; do
not bypass the ancestry check with `-D`. For that decision, inspect the actual
PR merge record, base, head and resulting commit plus remaining branch changes;
a merged badge alone does not prove that later commits are integrated.

Exclude and retain the current checkout, main worktree, default or protected
branches, locked worktrees, any staged/unstaged/untracked or valuable ignored
content, dirty submodules, active shells/agents/processes, unknown ownership,
symlink escapes, and paths outside the explicitly approved roots. An
unresolved state is a reason to inspect and report, not to force removal.

Before any mutation, present a dry-run table with one row per exact target:

| Absolute path | Verified repo | Branch | Tip SHA | Merge evidence | Clean / ignored / locked / liveness | Herdr workspace ID | Proposed operation | Preserve or remove reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Include retained and blocked targets, not only candidates. Ask for explicit
approval for the exact paths and operations in the table unless the user has
already authorized those exact removals. Skill creation, a broad cleanup
request, or approval of a different target is not approval. Do not delete
anything while approval is pending.

## 3. Execute only exact approved operations

Immediately before each individual mutation, repeat the relevant registration,
status, ignored-file, submodule, lock, liveness, branch-tip, and merge checks.
Any changed or unavailable state invalidates that candidate; retain and report
it. Do not use broad `rm -rf`, `git clean`, reset, `branch -D`, automatic
unlocking, process kills, or home-directory sweeping.

- For a Herdr-managed target, use the verified native command
  `herdr worktree remove --workspace ID` with the exact observed ID. Never pass
  `--force` or `--trust-repository`. This closes its workspace and panes, so
  require exact closure authorization and verified no live work first. Inspect
  the result and refreshed Herdr state.
- For a registered Git worktree not managed by Herdr, use
  `GIT_MASTER=1 git -C RETAINED_REPO worktree remove -- EXACT_PATH`, without
  force. If it refuses, stop and inspect; never force as a retry.
- Delete a local branch only as a separately approved operation, after proving
  no worktree anywhere in the repository holds it and rechecking its tip and
  safe ancestry to the chosen integration ref:
  `GIT_MASTER=1 git -C RETAINED_REPO branch -d -- EXACT_BRANCH`.
  Never delete a remote branch.
- Missing metadata may be audited with
  `GIT_MASTER=1 git -C REPO worktree prune --dry-run` only. Actual prune affects
  the whole repository: it requires separate approval naming that exact
  repository-wide operation. A missing directory may be an unmounted disk or
  unavailable network share: retain its registration until the volume is
  available or the user confirms permanent removal. Never prune a locked
  worktree or treat stale Herdr metadata as proof of deletion. Keep unregistered directories.

## 4. Verify and report

After each approved operation, verify the exact path is gone, Git registration
is gone, the local branch is gone only if separately requested, and Herdr has
no stale workspace entry. Confirm unaffected retained worktrees preserve their
status and HEAD. If a removal is refused or verification is uncertain, retain
what remains and report evidence; do not force or silently retry.

Report removed, retained, and blocked targets separately, with exact paths,
operations, and evidence. State whether Git, Herdr, ignored-file, submodule,
and liveness checks were available. Make no claim that a target is abandoned
without evidence. Stop when authorized operations are verified and all
remaining targets are reported.

## Scenario checks

- Clean, merged, unlocked, inactive candidate: table it; remove only after
  exact approval and immediate recheck.
- Current checkout, main worktree, default/protected branch: retain even clean
  and merged; a standalone branch still needs the same protection checks.
- Dirty, untracked, ignored, or submodule changes: retain and identify content.
- Active shell, process, agent, or idle agent: retain; idle is not abandonment.
- Locked worktree: retain; never unlock automatically.
- Unmerged branch or squash/rebase merge without ancestry: retain and ask for a
  separate decision; never force-delete.
- Stale metadata: dry-run audit only; scoped prune approval is separate.
- Missing path or unavailable mount: retain registration until resolved.
- Symlink escape, path outside approved roots, or unknown owner: retain.
- Herdr workspace with live panes: do not close; report that closure is blocked.
