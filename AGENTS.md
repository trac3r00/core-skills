# PROJECT KNOWLEDGE BASE

**Generated:** 2026-11-23
**Branch:** main

## OVERVIEW
core-skills: 83 general-purpose skills (Agent Skills SKILL.md standard) in 11 families: backend 18, connectors 6, creative 4, guards 7, interop 4, macos 10, orchestration 11, other 6, power 4, process 11, security 2. 44 ship Python CLIs (catalogue `script_backed`), 8 are Node-backed (`scripts/*.mjs` + `test/*.test.mjs`), and most of the remaining 31 are instruction-only. Every skill is authored by trac3r00 under MIT; comment-checker's detection rules are adapted from oh-my-opencode / oh-my-claudecode. The macos family is macOS-only; the orchestration family is OmO/Herdr-specific. `catalogue.json` (generated) is the inventory source of truth. Installable as a Claude Code / Codex plugin or used from a clone by any SKILL.md-reading agent.

## STRUCTURE
```
core-skills/
├── catalogue.json    # generated inventory (skill-picker/scripts/generate_catalogue.py); never hand-edit
├── .claude-plugin/   # marketplace.json (catalog) + plugin.json (metadata), version-locked together
├── .codex-plugin/    # Codex manifest; skills path ./skills/, no version field
├── .agents/plugins/  # generic marketplace manifest
├── skills/<name>/    # SKILL.md [+ scripts/*.py | scripts/*.mjs] [+ test/*.test.mjs] [+ references/]
└── tests/test_skills.py  # pytest module for the Python skill CLIs + repo-wide frontmatter validation
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a skill | `skills/<name>/SKILL.md` | frontmatter contract in skills/AGENTS.md; validated by tests |
| Add CLI tests | `tests/test_skills.py` | script const near `CB`..`SH`, use `run()` helper |
| Bump release | `.claude-plugin/*.json`, `.codex-plugin/plugin.json` | keep versions + descriptions in sync across all three |
| Skill families / inventory | `catalogue.json`, `README.md` family tables | regenerate the catalogue, then match README tables and counts to it |
| CI | `.github/workflows/tests.yml` | pytest matrix 3.10/3.12/3.13 + 2 smoke tests |

## CODE MAP
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `run(script,*args,stdin)` | helper | tests/test_skills.py:19 | subprocess runner all CLI tests share |
| `test_every_skill_has_valid_frontmatter` | test | tests/test_skills.py | repo-wide gate: name==dir, description present |
| `discover()` | fn | skills/skill-sync/scripts/skill_sync.py | provider-root scan, priority dedupe |
| `SCANNERS` | dict | skills/session-handoff/scripts/session_handoff.py | per-client session store readers |
| `PROVIDER_ROOTS` | const | skills/skill-sync/scripts/skill_sync.py | priority-ordered skill dirs per provider |

## CONVENTIONS
- CLI contract (the Python guard, security, interop, and backend CLIs): argparse, positional input or `-` stdin, `--json`, gates are strict `>` comparisons; rc 0 ok / 1 gate breach / 2 usage-or-input error.
- Guard, security, interop, and backend CLIs are stdlib-only; sole exception: `context-budget` optionally uses `tiktoken` (chars/4 fallback).
- Frontmatter: `name` (== dirname), `description`, `version`, `license` (MIT), `metadata.agentskills.tags`.

## ANTI-PATTERNS (THIS PROJECT)
- No network/credentials/LLM calls inside guard CLIs — offline and deterministic, always.
- Never overwrite user files in sync-type tools (skill-sync `skip-exists`; session-handoff is read-only).
- Tool claims stay honest: claim-audit is NOT a fact-checker; skill-decay "never used" is a review prompt, not proof; gate-graph overlap is a candidate, not semantic equivalence.
- Don't hand-edit one manifest: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` move together.

## COMMANDS
```bash
uvx pytest tests/ -q                 # Python suite
node --test skills/*/test/*.test.mjs # Node-backed skill tests
python3 skills/skill-picker/scripts/generate_catalogue.py --check  # catalogue in sync
python3 skills/<s>/scripts/<s>.py --help
```

## NOTES
- macOS: session-handoff normalizes `/tmp` -> `/private/tmp`; cwd matching is target-or-child, never parent.
- CI tests Python 3.10 while README floor is 3.10 too — keep them aligned when bumping.
