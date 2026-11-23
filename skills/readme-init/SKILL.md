---
name: readme-init
description: "Create or refresh a README from what the repo contains: code, manifests, commands. Use for writing or fixing a README. Not for a cited overhaul (init-readme)."
version: 1.1.0
license: MIT
compatibility: "Instruction-only. Uses the host's file, search, and shell tools; no credentials, scripts, or runtime patch."
metadata:
  evaluation: "unbenchmarked"
  agentskills:
    tags: [readme, docs, documentation]
---

# README Init

Produce a README whose every claim a reader can verify in the repository.
For a full overhaul with delegated evidence and a review gate, use
`init-readme`; for AGENTS.md use `init-deep`, for rules use `init-rules`. A README speaks to people who want to
understand, install, and use the project.

## 1. Scope the target

Use the requested repository, or the current one when unambiguous. Never treat
a home directory as a project. Find the root README (any case, `.md`/`.rst`/
`.txt`) and any per-package READMEs. Ask for a path only if no project is
identifiable.

Decide the mode: **create** when none exists, **update** when one does. For a
monorepo, write the root README as an index and touch package READMEs only
when asked.

## 2. Gather evidence

Read before writing. Collect only what is present:

- Purpose and name: manifest description, entry points, existing docs.
- Install and run: package manifest scripts, Makefile/justfile, Dockerfile,
  `bin` entries, lockfile (which package manager is actually used).
- Test and build: the commands CI runs, not guessed defaults.
- Requirements: runtime/engine versions from manifests or toolchain files.
- Usage: real CLI flags (`--help` output or argument parser), exported API,
  config files and environment variables read by the code, examples/ dir.
- Layout, license, contributing/security files, docs directory.
- Audience: who installs or calls this (end user, library consumer,
  contributor) as implied by packaging and existing docs.

Run a command only if it is read-only and inspected first (`--help`, `--version`).
Prefer verifying a documented command over copying it. Mark anything you could
not confirm as unknown; do not fill the gap from convention.

## 3. Write

Lead with what the project is and who it is for in one or two sentences, then
the fastest path to a working result. Typical order, dropping sections with no
evidence: install, quick start, usage/configuration, development (build, test),
project layout, contributing, license. Link to existing docs instead of copying
them. Keep it as short as the project allows; depth belongs in `docs/`.

Rules that hold in every mode:

- Never invent features, flags, badges, versions, benchmarks, URLs, or
  roadmap items. If it is not in the code or docs, it is not in the README.
- Every command shown must exist in the repository's scripts/CI or have been
  run. Use the repository's own package manager.
- No placeholder text (`TODO`, `your-org/your-repo`) in the output; omit the
  section or state the unknown plainly.

## 4. Update mode: preserve what the user wrote

Diff intent, not just text. Keep existing prose, structure, tone, badges, and
hand-written sections unless the evidence shows them wrong. Change only:
statements that contradict the code, commands that no longer exist, and
sections the user asked about; add missing sections around what is there.
Never delete content you cannot disprove. Keep locale/language of the existing
README. Respect generated or marked regions (`<!-- ... -->` markers) and do not
edit them by hand. If the README has uncommitted changes, edit in place and
touch nothing else; do not stash, reset, or commit.

## 5. Check and report

Re-read the result against the evidence: each command, path, env var, and
version appears in the repository; relative links resolve; code fences are
balanced. Report the README path(s), what was added or corrected and from which
source, the commands you verified or ran, and what remains unknown or was left
for the owner to confirm. Do not claim the README is complete beyond the
evidence gathered.
