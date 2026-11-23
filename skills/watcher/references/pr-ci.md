# Delivering a fix as a PR with CI

A fix is delivered only when its PR exists and CI has a verdict. This page is
the exact sequence; the authority boundaries in `SKILL.md` still apply.

## Preflight

```sh
git rev-parse --show-toplevel
git remote -v
gh auth status
git fetch origin
git symbolic-ref --short refs/remotes/origin/HEAD   # origin/main or origin/master
```

Stop the branch and record the missing piece when there is no remote, no `gh`
login, or no default branch. Never substitute a local commit for a PR.

## Branch

```sh
git switch -c watcher/<topic>-<short-session-id> origin/<default>
```

- `<topic>`: three to five lowercase words, hyphenated.
- `<short-session-id>`: the first eight characters of the OmO session id, so a
  PR can be traced back to the session that produced it.
- Never branch from a dirty working tree's unrelated changes. If the fix needs
  them, name that dependency and stop.
- One watcher branch per fix. Do not stack unrelated fixes.

## Apply the change

Host fix: edit only the files in the fix's scope, run the checks, and inspect
the diff.

Runner fix:

```sh
omo-mods runner pull <repo> --to <runner>
```

The command prints its staging directory under
`~/.omo/mods/runner-staging/<repo>-<timestamp>` containing `changes.patch`,
`untracked.tgz`, `new-commits.txt`, and session transcripts.

```sh
git apply --3way <staging>/changes.patch
tar -xzf <staging>/untracked.tgz -C <repo>
```

Read the patch before applying it. The runner never pushes to origin itself;
delivery is the watcher's job. If the patch conflicts, resolve it only inside
the watcher branch and record the conflict.

## Verify

Use the project's own commands from its instructions or `package.json`. For
this repository:

```sh
bun run typecheck
bun test <related tests>
node --test skills/*/test/*.test.mjs
```

A passing test suite does not prove the requested behavior; exercise the real
entry point and record what you observed. Never delete or skip a failing test
to make CI green.

## Commit and push

```sh
git add <only the in-scope paths>
git commit -m "<type>(<area>): <imperative summary>" -m "<evidence: command and observed result; session id>"
git push -u origin watcher/<topic>-<short-session-id>
```

Do not amend or force-push a branch that has an open PR unless the user asked.

## Open the PR

```sh
gh pr create --base <default> --head watcher/<topic>-<id> \
  --title "<imperative summary>" \
  --body "Session: <id> (<cwd or runner>)\n\n## Change\n…\n\n## Evidence\n- <check> -> <result>\n\n## Left open\n- <pending approval or known gap>"
```

`--fill` is acceptable only when the commit messages already contain the change
and evidence. Always name the session and the checks; a reviewer must be able
to reproduce them.

## Watch CI

Register the watch before relying on the result; do not sleep in the turn:

```sh
gh pr checks <number> --watch --fail-fast
gh run watch <run-id> --exit-status
```

Run either through the host's monitor mechanism, filtering the decisive lines
(the failing job name, `All checks have passed`, `Some checks were not
successful`). A watch that has not reported is pending, not green. After it
fires, read `gh pr checks <number>` once to record the final verdict.

## On failure

1. Read the failing job log (`gh run view <run-id> --log-failed`).
2. Reproduce the command locally where possible.
3. Fix on the same branch, commit, push, and watch again.
4. Three rounds maximum. Then leave the PR open with the failing check name,
   the log location, and what you tried in the ledger.

## Never

- merge, auto-merge, or approve the PR;
- push to the default branch;
- force-push or rewrite shared history;
- close another person's PR or session;
- mark a skipped check as passed;
- publish a package, release, or deploy from CI without explicit authority.

## Record

In the ledger row, write the branch, PR number and URL, each check with its
verdict, the round count, and any pending approval. When the user returns, the
ledger must let them decide what to merge without rereading the session.
