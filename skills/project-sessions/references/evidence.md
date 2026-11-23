# Evidence and verification boundaries

Revision: 0.2.0. Inspected on 2026-10-22.

## Source mechanisms

- User requirement: start from the familiar project directory, discover multiple
  independent conversations across worktrees, and continue one without manually
  changing directories or locating a UUID. Preserve each task's code isolation.
- Installed Herdr 0.9.5, client/server protocol 22: `herdr status --json` and
  `herdr worktree create --help` were checked. The installed Herdr skill's
  `references/cli-reference.md` documents explicit workspace targeting,
  `tab create --cwd --no-focus`, returned root pane IDs, `pane run`, agent listing,
  and tab focusing. Revalidate against installed help before executing.
- Installed Senpi runtime 2026.10.19-2, `dist/core/session-manager.js`:
  `getDefaultSessionDirPath` groups transcripts by encoded cwd under the agent's
  sessions directory. `SessionManager.list` is cwd-scoped; `listAll` scans stored
  session directories. Therefore filesystem isolation and transcript storage are
  separate, but directory-based discovery can hide sibling-worktree history.
- The same runtime's `dist/cli/args.js` documents `--session <path|id>`,
  `--continue`, `--fork`, and `--rebind`. `dist/cli/cross-project-session.js`
  confirms that opening from a different project path can offer rebind/fork.
  Preserving the original cwd avoids treating navigation as session migration.
- Installed `coding-agent-sessions` skill, `references/senpi.md`, and
  `scripts/agent_sessions/cli.py`: the `senpi` platform covers OmO/Senpi/Pi
  transcript roots; output includes UUID, path, cwd, prompts, and timestamps.
  `--cwd` is a case-insensitive substring filter. `_list_payload` reports returned
  count, not a separate total, and applies its result limit before the caller's
  repository filtering. A full page is not evidence of exhaustive discovery.
- Git's local `worktree list --porcelain -z` exposed the main checkout and its
  registered linked worktrees from the main directory without switching cwd.
  Repository membership must use common Git directory identity, not labels.

These are local source inspections and read-only observations, not guarantees
about future versions or other cleanup tools.

## Initial checks (0.1.0)

- Native `loadSkills` discovered exactly one `project-sessions` package at the
  user skill location, with no diagnostics for this package or name collisions.
- The installed `AgentSession._expandSkillCommand` expanded
  `/skill:project-sessions list` using that exact file and emitted its native
  `skill_invocation` event. This checks command expansion, not a full interactive
  request or whether an already-open session has reloaded its catalog.
- The existing finder ran from the main checkout and returned three saved
  worktree conversations with transcript paths and original working directories;
  exit code was 0. This was a capped smoke check, not a complete session census.
- One returned transcript's session header independently confirmed its UUID and
  worktree cwd. Git reported the same common directory for that worktree and the
  main checkout. An unrelated non-repository directory failed Git identity
  resolution and was not accepted as a match.
- The final package and its relative reference were inspected. No helper code or
  prose-pinning tests were added.
- No existing conversation was resumed, no Herdr tab was created, and no coding
  prompt was sent during validation. Interactive resume and automatic skill
  selection remain untested; no comparative performance claim is made.

## New-task procedure (0.2.0)

- The user's clarification requires explicit task creation under one existing
  project group, without loading the skill or starting a conversation implicitly
  creating another workspace. Independent tasks get separate checkouts; multiple
  conversations for one task reuse its checkout.
- Installed Herdr's protocol-22 `WorkspaceWorktreeInfo` exposes `repo_key`,
  `repo_root`, `checkout_path`, and `is_linked_worktree`. `WorktreeSourceInfo`
  exposes the source workspace and main repository root. These establish group
  identity without inventing a general parent-workspace API.
- omo-mods' `src/modules/worktrees/core.ts` uses `worktree create` with an
  existing workspace, branch, immutable base commit, label, and `--no-focus`,
  then reads `workspace.worktree.checkout_path` and `root_pane`. The skill reuses
  those native Herdr operations without adding a second launcher or registry.
- Automatic client launch isolation and its recursion marker have been removed.
  The creation procedure invokes the resolved OmO executable directly in the
  explicit task checkout. Transcript resumes remain distinct from fresh named
  conversations.
- This remains an instruction-only skill. Loading and invocation expansion are
  separate from exercising a complete interactive new-task request.
- Native skill discovery and explicit expansion of
  `/skill:project-sessions new 로그인 수정` loaded the installed 0.2.0 revision
  without diagnostics. All three skill files matched the repository copies.
- An isolated Herdr server created two clean linked checkouts against one
  existing main workspace. Both returned the same repository key, separate
  paths and branches, and the requested base commit. Workspace inventory showed
  one main project and two linked children. Reopening the first checkout reused
  its workspace ID without increasing the workspace count.
- The smoke check confirmed unchanged main source status, HEAD, and pane cwd.
  Concurrent build outputs were excluded from the source-status comparison.
  Its temporary server, worktrees, branches, and scratch directory were removed
  in teardown. Named-session selection alone did not start a server; the check
  explicitly started its own server before retrying.
- `npm run check` passed typecheck, build, 1,156 Bun tests, and the bundled
  skills' Node tests. The installer check includes both reference files.
- No OmO conversation or coding prompt was launched in the smoke check.
  Interactive conversation startup and model-driven execution of the whole
  instruction sequence remain untested.

## Limits

- A skill supplies instructions to an agent. It does not patch OmO's picker or
  implement a new built-in slash command.
- A transcript surviving outside a deleted checkout does not mean its old files,
  uncommitted work, process, or environment survive.
- Pruned worktrees may leave no trustworthy repository identity for historical
  transcripts. Show uncertainty rather than guessing or resuming on main.
- This instruction-only package adds no scripts, background services, indexes,
  transcript rewrites, or automatic worktree cleanup.
- Structural loading and read-only listing checks do not demonstrate an actual
  interactive resume. Record that separately when exercised.
- No comparative benchmark or automatic-routing effectiveness is claimed.
