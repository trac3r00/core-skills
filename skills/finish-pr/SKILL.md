---
name: finish-pr
description: "Commit scoped work, open or update a labeled PR, verify checks on its exact head. Use when asked to finish or PR work. Not for cleanup (cleanup-worktrees)."
version: 0.2.0
license: MIT
compatibility: "Instruction-only. Requires repository tools and GitHub CLI access for publication and CI monitoring."
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [git, pull-requests, github, ci, commits]
---

# Finish PR

Finish an implementation for developer review: preserve the intended change,
publish it under the user's authority, and report CI evidence bound to the
current pull request head. Trigger after implementation when asked to finish,
ship, commit, or make a PR. A review-only request is not publication authority.
Authoring a skill is not publication authority for the work it describes.

An explicit request to create/update a PR authorizes the needed scoped commits,
push, and PR writes; do not ask repeatedly. A commit-only request authorizes
commits, not a push or PR. Interpret "ship" from the user's stated destination,
not as permission to deploy or merge. Without the relevant request,
inspect and prepare an exact commit and PR payload, then ask before committing
or publishing. Never infer authority to merge, dispatch a workflow, or expand
scope. Do not weaken tests or report unverified checks as passing.

## 1. Establish repository state

Read applicable `AGENTS.md`, `CONTRIBUTING.md`, PR template, and relevant
workflow files. Inspect `git status`, staged and unstaged diffs, recent commit
messages, remotes, current branch, and its base/head relationship. Check branch
policy, required checks, existing labels, and `gh auth status`. Inspect
`gh pr list`, `gh label list`, and the PR template before proposing changes.
Use the repository's `git-master` and `review-work` skills when available.
When `git-master` is active, prefix every Git command with `GIT_MASTER=1`.
If `git config core.bare` prints `true` in a checkout that has a worktree,
run every Git command as `git --git-dir=.git --work-tree=.` and never change
`core.bare`.

Preserve unrelated and already-staged user changes. Never use `git add .`.
Select the correct base from repository policy or the existing PR; do not
blindly assume the default branch. Honor fork remotes and branch policy. If
authentication or repository state prevents safe publication, finish all
independent work and report the exact blocker.

If on the default branch, a protected branch, or a detached HEAD, create a new
feature branch before committing. Do the same for an unrelated feature branch
only after identifying the intended starting ref; retain the original branch.
Choose its name from repository branch naming conventions and the scoped change. If already on a correctly scoped feature
branch, reuse it. Preserve all user changes across the switch; do not stash,
discard, or move unrelated changes. Create the branch with `git switch -c
BRANCH` only after confirming the destination name is unused and the switch
will retain the worktree state. Do not create a branch when the user only
authorized preparation; include the proposed branch name in the approval
payload instead.

## 2. Review, test, and prepare changes

Review the implementation diff for scope and correctness. Run the repository's
existing tests and relevant real QA for changed behavior. Report exact commands
and results; never claim tests or QA that did not run. Tests should assert
machine behavior, not prose or prompt wording. Fix in-scope failures without
skipping, weakening, or deleting tests. Keep unrelated findings out of scope.

Choose a concise commit type, scope, and message from repository convention.
Use Conventional Commits only if established by project guidance/history or if
no convention exists. Typical types include `feat`, `fix`, `docs`, `refactor`,
`test`, `build`, `ci`, and `chore`. Explain a breaking change in the PR.
Stage only reviewed paths with explicit path arguments, inspect the staged
diff, then create scoped atomic commits. Do not amend, force-push, or merge
unless the user explicitly authorizes that action.

Without publication authority, stop before commit/push/PR writes. Present the
exact proposed commit message, path list, PR title/body, base/head, and labels
for user approval.

## 3. Publish or reuse the PR

With authority, commit the reviewed staged changes, then push the authorized
branch to its proper remote. Push and PR events normally trigger CI according
to workflow configuration. Inspect event triggers, path/branch filters, and
approval requirements. Use `workflow_dispatch` only when the workflow supports
it and the user explicitly authorized that CI scope.
For that case use `gh workflow run WORKFLOW --ref HEAD`, with required inputs
from the workflow definition. Record dispatch time, then identify the resulting
run by workflow, event, ref and SHA; dispatch success is not CI success.

Before creating a PR, find any existing PR and verify repository, head, and
base. Reuse and update that PR rather than creating a duplicate. Useful
commands:

```sh
gh pr list -R OWNER/REPO --head HEAD --base BASE --state open
gh pr view PR --json url,headRefName,baseRefName,headRefOid,labels
gh label list -R OWNER/REPO
gh pr create -R OWNER/REPO --base BASE --head HEAD --title TITLE --body BODY --label LABEL
gh pr edit PR --title TITLE --body BODY --add-label LABEL
```

Replace example tokens with inspected values, quote shell arguments, and use
the returned full PR URL for `PR` to disambiguate forks. For fork creation,
verify the head owner/repository rather than matching a branch name alone.
After any ambiguous create error, look up the PR before retrying: creation
may have succeeded while a label or other metadata update failed.
Use only labels present in the repository; do not invent them. Categorize the
PR with an appropriate existing label, such as feature, bug fix, documentation,
or maintenance. If none fits, omit `--label`, explain the category in the
title/body, and report that no matching label exists.
The body states purpose, scope, actual QA evidence, and known
risks. Follow the template. Do not claim checks passed before observing them.
Record the PR URL, base, branch, current head SHA, commit IDs, and labels.

## 4. Monitor CI for the exact PR head

The user's own projects run checks locally with Bun and full suites on their
private Proxmox CI box (see `ci-test-rebuild`), not on GitHub Actions. Never
add a workflow or dispatch hosted CI to get a green badge. When the repository
has no hosted checks, the evidence is the local check command and its exit
code on the pushed head SHA, plus the CI box result when one exists; report
"no hosted checks" instead of waiting for them. The rest of this section
applies only where hosted checks exist.

Capture `headRefOid` from `gh pr view` before monitoring. Inspect the complete
check state with:

```sh
gh pr checks PR --json name,state,bucket,link,workflow
gh pr checks PR --watch
```

The watch must not fail fast: observe every relevant check. `gh pr checks`
documents exit code 8 for pending checks. Empty or missing checks, skipped,
cancelled, pending, and approval-blocked checks are not automatic success.
Determine expected checks from workflow configuration and repository policy.
Wait through an asynchronous monitor, never a child task or foreground sleep
loop. In OmO, start `tool.monitor({description,command,filter})` inside `eval`
and return the handle; use the host's equivalent only when `eval` is
unavailable. Watch with `gh pr checks PR --watch` or, for one run,
`gh run watch RUN_ID --exit-status`. For checks expected but not yet visible,
monitor a bounded command that re-reads
`gh pr checks PR --json name,state,bucket,link,workflow` until an expected
check appears and prints a sentinel matched by `filter`. If they do not
appear within the bound, diagnose and report the missing coverage as a
blocker.

Associate workflow runs with the current PR head; never assume the first run
for a branch belongs to this attempt. Inspect candidate runs and their event,
time, workflow, and SHA:

```sh
gh run list --branch HEAD --json databaseId,headSha,event,status,conclusion,workflowName,url
gh run view RUN_ID --json headSha,event,status,conclusion,url
```

For `pull_request` workflows, a merge-ref SHA can differ from the source
commit. Associate that run through the PR and event, not a naive SHA mismatch.
After all expected checks complete, re-read the PR head SHA. If it changed,
discard prior green evidence and monitor the new head. Stop only when relevant
expected checks completed appropriately for an unchanged head, or a genuine
blocker is explained.

For failed runs, inspect `gh run view RUN_ID --log-failed`. Fix only in-scope
causes, rerun relevant tests and QA, and monitor the newly published head when
authorized. Do not blindly retry. Report exact permission, approval, or
external infrastructure failures when those block progress.

## 5. Report outcome and maintain

Report the PR URL, branch/base, final head SHA, commit IDs, category labels,
checks and run links with their actual states, QA performed, and unverified
gaps or blockers. Do not describe missing, skipped, cancelled, or stale checks
as green.

This package is instruction-only; live PR and CI behavior remains unbenchmarked
until exercised with authorization. After installing or updating the skill,
reload the host's skills before invoking it. Invoke natively with
`/skill:finish-pr` or `$finish-pr`.

Maintain this procedure when repository/GitHub CLI behavior, branch policy,
required checks, or workflow triggers change. Verify the syntax of each `gh`
command above in the [GitHub CLI manual](https://cli.github.com/manual/)
(pages are named like `gh_pr_checks`), and event behavior in
[Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
Do not treat this maintenance pointer as evidence that a live command or
workflow was exercised.
