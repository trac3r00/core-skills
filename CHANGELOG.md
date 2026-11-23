# Changelog

All notable changes to core-skills. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-23

First release as **core-skills**: 83 skills, all authored by trac3r00, for any AI client that reads the
SKILL.md (Agent Skills) format: Claude Code, Codex, OmO, Cursor and others.

### Breaking

- The repository and plugin are renamed from `agent-skills` to `core-skills`
  (`github.com/trac3r00/core-skills`; the old URL redirects). Reinstall the plugin under its new name.
- Third-party skills are no longer bundled. Install them from their own repositories if you used them:
  - oh-my-openagent: `git-master`, `lsp-setup`, `remove-ai-slops`, `ultimate-browsing`, `visual-qa`
  - anthropics/skills: `algorithmic-art`, `design`, `skill-creator`, `webapp-testing`
  - openai/skills: `gh-fix-ci`, `gh-address-comments`
  - obra/superpowers: `systematic-debugging`, `test-driven-development`, `using-git-worktrees`,
    `verification-before-completion`
  - hiendinhngoc/unknowns: `blindspot`, `verify-ref`, `log-deviation`, `merge-quiz`
  - others: `css-pro-tips`, `domain-modeling`, `grilling`, `linus-level`, `nbj-write-clearly`,
    `skill-optimizer`
- Python 3.10 or later is required (3.9 reached end of life in October 2025). CI tests 3.10, 3.12 and 3.13;
  `macos-settings` needs 3.12+.

### Added

- 42 skills from omo-mods, in three new families and two existing ones:
  - **orchestration** (OmO and Herdr): `max-build`, `watcher`, `omo-runner`, `optimize-omo-config`,
    `apps-handoff`, `browser-aside`, `project-sessions`, `prompt-builder`, `reorient`
  - **macos**: `apple-home`, `apple-tv`, `finder`, `iphone-mirroring`, `macos-settings`, `moffice`,
    `phone-facetime`, `spotify`
  - **connectors**: `discord-messenger`, `slack-messenger`, `kakao-messenger`, `notion`, `obsidian-vault`,
    `vaultwarden`
  - **process**: `anti-bs`, `loe`, `dft`, `fdd`, `preflight`, `init-rules`, `finish-pr`, `cleanup-worktrees`,
    `ci-test-rebuild`, `cyber-bypass`
  - **creative / power / other**: `claude-design`, `karpathy-prompt`, `create-skills`, `init-readme`,
    `readme-init`, `game-film`, `side-hustle`, `tv-detox`
- Node-backed skills ship `scripts/*.mjs` with `test/*.test.mjs`; run them with
  `node --test skills/*/test/*.test.mjs`.
- `catalogue.json` and `skill-picker` cover the new families, plus `data` and `writing` personas.

### Changed

- `herdr` 1.1.0, `pro-review` 2.0.0 (own Pro-checked ChatGPT transport, no Oracle dependency),
  `apple-suite` 1.0.2, `session-finder` 1.2.1 and `sys-health` 1.0.3 are synced with their newer omo-mods
  versions.
- `appshot` 1.0.5: `APPSHOT_SCREENCAPTURE` / `APPSHOT_OSASCRIPT` override the macOS binaries, captures go
  through a private temp file that is renamed into place, and a missing `osascript` exits 2 instead of
  crashing.
- `sys-health` reports load as `m1` / `m5` / `m15` (was `1m`, ...).
- "Pairs with" lists no longer point at removed skills.
