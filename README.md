# Core Skills

Core Skills is a library of general-purpose skills for any AI client that reads the SKILL.md ([Agent Skills](https://agentskills.io)) format. It mixes dependency-light Python and Node tools for auditing agent context, output, handoffs, recurring costs, gate overlap, and capability usage with instruction-only skills for engineering process, design, writing, orchestration, macOS automation, and app connectors.

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

Core Skills holds 83 skills in 11 families. `catalogue.json` at the repo root is generated from `skills/` and is the source of truth for the inventory.

| Family | Skills | What's in it |
| --- | --- | --- |
| [Guards](#guards) | 7 | Runnable audit CLIs with exit-code gates for agent context, output, transcripts, and spend. |
| [Security](#security) | 2 | Credential scanning for code and diffs, and security scanning for third-party skills. |
| [Interop](#interop) | 4 | Moving skills, session context, rules, and token accounting between AI clients. |
| [Backend](#backend) | 18 | Offline CLIs and review protocols for APIs, logs, config, cron, repos, diffs, docs, and the web. |
| [Process](#process) | 11 | Engineering discipline: expectations, project rules, fuzzing, dogfooding, response audits, PRs, and release checks. |
| [Creative](#creative) | 4 | 3D scenes, Claude Artifacts, image generation, and verifiable writing. |
| [Power tools](#power-tools) | 4 | Heavyweight skills for skill authoring, README overhauls and refreshes, and second-opinion code review. |
| [Orchestration](#orchestration) | 11 | Running and supervising OmO sessions and Herdr panes, runners, and handoffs. |
| [macOS](#macos) | 10 | Scripting Apple apps, Finder, settings, screenshots, calls, Office, and Spotify on a Mac. |
| [Connectors](#connectors) | 6 | Discord, Slack, KakaoTalk, Notion, Obsidian, and Vaultwarden. |
| [Other](#other) | 6 | Skills outside the main families: skill-picker, research, Proxmox VE, and personal projects. |

Forty-four skills ship standalone Python CLIs. Eight are Node-backed: they ship `scripts/*.mjs`, and Node skills keep their tests in `test/*.test.mjs`. Most of the remaining 31 are instruction-only, where the `SKILL.md` is the skill.

Some skills only work in a specific environment:

- **macOS-only:** the whole [macOS](#macos) family drives native Mac apps. `sys-health` and `kakao-messenger` also target a Mac.
- **OmO/Herdr-specific:** the [Orchestration](#orchestration) family assumes an OmO install, and several of its skills drive Herdr.

Every skill in the repository is authored by trac3r00 and released under the MIT License. The one borrowed piece is `comment-checker`, whose detection rules are adapted from oh-my-opencode / oh-my-claudecode. `proxmox-ve` pulls its MCP server from the owner's own [trac3r00/proxmox-mcp](https://github.com/trac3r00/proxmox-mcp) repository as a git submodule.

The repository can be used directly from a clone or installed as the `core-skills` plugin for Claude Code or Codex.

## Why your workload needs this

Every agent workload fails the same ways: the agent asserts instead of proving, context quietly bloats until quality drops, work fragments across clients, and AI-generated code smells pile up. Each of those failures has a cheap, enforceable countermeasure. Find your workload:

| Your workload | What silently breaks | Required skills |
| --- | --- | --- |
| **Long-running autonomous agents** | Context grows every turn; cost climbs and quality drops with no alarm | [`context-budget`](skills/context-budget/), [`skill-decay`](skills/skill-decay/), [`open-loops`](skills/open-loops/) |
| **Shipping agent-written code** | Narration comments, slop patterns, and unverified "done" claims reach main | [`comment-checker`](skills/comment-checker/), [`claim-audit`](skills/claim-audit/), [`anti-bs`](skills/anti-bs/) |
| **Multi-client workflows** (Claude Code + Codex + others) | Skills fragment per client; work context dies when you switch | [`skill-sync`](skills/skill-sync/), [`session-handoff`](skills/session-handoff/) |
| **Debugging and hard fixes** | Symptom patches instead of root causes; regressions hide behind refactors | [`fdd`](skills/fdd/) |
| **Per-model working agreements** | Generic AGENTS.md bloat every model session; Astra needs lean, gated behavior instead | [`astra-init`](skills/astra-init/) |
| **Planning and review discipline** | Weak plans survive until implementation exposes them | [`loe`](skills/loe/) |
| **Releases and pull requests** | PRs open with unchecked heads; releases ship without a real pre-live check or a dogfood pass | [`finish-pr`](skills/finish-pr/), [`preflight`](skills/preflight/), [`dft`](skills/dft/), [`ci-test-rebuild`](skills/ci-test-rebuild/) |
| **Docs and technical writing** | Prose that buries the answer; docs that drift from reality | [`karpathy-prompt`](skills/karpathy-prompt/), [`readme-init`](skills/readme-init/) |
| **Security-sensitive repos** | Agents paste real credentials into examples; installed skills carry injection payloads | [`secret-gate`](skills/secret-gate/), [`skill-audit`](skills/skill-audit/) |
| **Token cost control** | No client shows cross-client consumption; budgets blow silently | [`usage-audit`](skills/usage-audit/), [`context-budget`](skills/context-budget/) |
| **Backend / deployment** | New env keys never make it to prod; the deploy crashes at 2am; endpoints return 500s nobody checked | [`env-gate`](skills/env-gate/), [`api-tester`](skills/api-tester/), [`log-analyzer`](skills/log-analyzer/) |
| **Security / headers** | Pages ship without HSTS or CSP; clickjacking and downgrade attacks stay open | [`sec-headers`](skills/sec-headers/), [`secret-gate`](skills/secret-gate/), [`skill-audit`](skills/skill-audit/) |
| **Sysops / network** | "Is the box okay?" and "is it reachable?" have no fast deterministic answers | [`sys-health`](skills/sys-health/), [`net-probe`](skills/net-probe/), [`cron-audit`](skills/cron-audit/) |
| **Proxmox VE administration** | API calls can mutate cluster state or expose local files without a deliberate workflow | [`proxmox-ve`](skills/proxmox-ve/) |
| **3D / image generation** | First generations miss the brief; Three.js scenes look like tutorials | [`image-gen`](skills/image-gen/), [`3d-design`](skills/3d-design/) |
| **Graph / dependency data** | Dependency chains and state machines are edge lists nobody can query | [`graph-tools`](skills/graph-tools/) |
| **Browser extensions** | MV3 boilerplate wastes the first hour of every extension project | [`ext-scaffold`](skills/ext-scaffold/) |
| **Code review triage** | Reviewers waste time on debug prints, TODOs, and trivial assertions that a machine should catch first | [`diff-review`](skills/diff-review/), [`comment-checker`](skills/comment-checker/), [`code-review`](skills/code-review/) |
| **Finance / portfolio** | A brokerage export tells you what you own, not whether one position is too big | [`portfolio-audit`](skills/portfolio-audit/) |
| **Documents** | Agents can't read docx/pptx/xlsx without installing heavy tooling | [`doc-reader`](skills/doc-reader/), [`moffice`](skills/moffice/) |
| **Web / SEO** | Pages ship without title, meta description, or alt text, so they're invisible to search and share | [`seo-audit`](skills/seo-audit/) |
| **Career / job search** | Resumes get filtered by ATS before a human reads them; weak bullets and missing keywords are invisible to the writer | [`resume-audit`](skills/resume-audit/) |
| **Project onboarding** | Every project has "the agent did X wrong, we told it Y" moments that future sessions repeat | [`session-rules`](skills/session-rules/), [`init-rules`](skills/init-rules/), [`reorient`](skills/reorient/) |
| **macOS automation** | Agents can't touch the user's Notes, Reminders, Calendar, Mail, Finder, or settings without an API layer | [`apple-suite`](skills/apple-suite/), [`finder`](skills/finder/), [`macos-settings`](skills/macos-settings/) |
| **Messaging and knowledge lookups** | Answers sit in Slack, Discord, KakaoTalk, Notion, or Obsidian where the agent can't read them | [`slack-messenger`](skills/slack-messenger/), [`discord-messenger`](skills/discord-messenger/), [`kakao-messenger`](skills/kakao-messenger/), [`notion`](skills/notion/), [`obsidian-vault`](skills/obsidian-vault/) |
| **UI / visual delivery** | Functional tests pass while the layout is broken, the font is wrong, or the CJK glyphs are corrupted | [`appshot`](skills/appshot/) |
| **Agent administration** | Multiple agent clients run at once; nobody knows which are alive, stuck, or killable | [`session-finder`](skills/session-finder/), [`session-handoff`](skills/session-handoff/), [`usage-audit`](skills/usage-audit/) |
| **Driving other agents in terminals** | Sibling agents get launched by hand; reading their output, waiting for them, and coordinating layout has no scriptable surface | [`herdr`](skills/herdr/), [`project-sessions`](skills/project-sessions/), [`watcher`](skills/watcher/) |
| **Independent second opinions** | Self-review rubber-stamps its own blind spots; pasting code into a chat loses scope, files, and any way to check the answer | [`pro-review`](skills/pro-review/) |
| **Social research** | Social content is behind logins and JS walls; public APIs go unused | [`social-research`](skills/social-research/) |
| **Personal ops** | Forgotten subscriptions keep billing | [`subscription-audit`](skills/subscription-audit/) |
| **Maintaining a skill library itself** | Redundant gates, dead skills, bloated instructions tax every prompt | [`gate-graph`](skills/gate-graph/), [`create-skills`](skills/create-skills/) |

## Skills by family

Purposes below are shortened from each skill's `description` in `catalogue.json`. To query the inventory by persona, family, keyword, or tag, use [`skill-picker`](skills/skill-picker/).

### Guards

All guard CLIs support JSON output, run offline, and need no credentials or network access.

| Skill | Purpose | Optional gate |
| --- | --- | --- |
| [`claim-audit`](skills/claim-audit/) | Separates grounded, hedged, and bare factual claims in AI output to surface likely hallucinations. It's a linter, not a fact-checker. | `--fail-over` |
| [`comment-checker`](skills/comment-checker/) | Flags newly written comments and docstrings in files or diffs; BDD markers, lint directives, license headers, shebangs, and TODOs auto-pass. | `--fail-over` |
| [`context-budget`](skills/context-budget/) | Ranks what eats an agent's per-turn context (system prompt, skills, memory, tool schemas) and fails CI when it grows. | `--budget` |
| [`gate-graph`](skills/gate-graph/) | Finds overlap and dead weight in a Python gate layer from AST fingerprints and an overlap matrix. | `--max-gates`, `--max-overlap` |
| [`open-loops`](skills/open-loops/) | Extracts unresolved commitments, deferrals, decisions, and open questions from a transcript into a JSON ledger. | `--max-open` |
| [`skill-decay`](skills/skill-decay/) | Cross-references a skill, tool, or plugin inventory against usage logs to find declared-but-unused entries. | `--max-decay`, `--fail-on-never` |
| [`subscription-audit`](skills/subscription-audit/) | Finds recurring charges in a bank or card CSV, totals monthly and yearly cost, and flags ones that look forgotten. | `--budget` |

### Security

| Skill | Purpose | Optional gate |
| --- | --- | --- |
| [`secret-gate`](skills/secret-gate/) | Scans files or a diff for known key formats, private keys, JWTs, assigned passwords, and high-entropy assigned strings, offline. | exit 1 on findings |
| [`skill-audit`](skills/skill-audit/) | Security-scans third-party skills for prompt-injection and data-exfiltration patterns before you trust them. | `--fail-over` |

### Interop

| Skill | Purpose | Optional gate |
| --- | --- | --- |
| [`session-handoff`](skills/session-handoff/) | Reads session logs from Claude Code, Codex, OpenCode, and Gemini CLI and writes a portable handoff briefing. | - |
| [`session-rules`](skills/session-rules/) | Generates a RULE.md from every moment a human corrected the agent in a project's session history. | - |
| [`skill-sync`](skills/skill-sync/) | Finds custom skills across every AI provider install and unifies them into one universal directory, using symlinks by default. | `--fail-on-conflict` |
| [`usage-audit`](skills/usage-audit/) | Totals token and session usage across the local stores of Claude Code, Codex, and OpenCode. | `--budget-tokens` |

### Backend

| Skill | Purpose | Optional gate |
| --- | --- | --- |
| [`api-tester`](skills/api-tester/) | Sends real HTTP requests and checks status code, JSON field values, latency, and content type with stdlib urllib. | exit 1 on mismatch |
| [`changelog-gen`](skills/changelog-gen/) | Builds a categorized changelog skeleton from conventional commits since a tag or ref. | - |
| [`code-review`](skills/code-review/) | Strict review protocol for a diff where every claim needs evidence, across correctness, security, error handling, contracts, performance, and tests. | - |
| [`cron-audit`](skills/cron-audit/) | Expands each crontab schedule into concrete values, explains it in plain words, and flags invalid, impossible, or over-frequent jobs. | exit 1 on invalid |
| [`diff-review`](skills/diff-review/) | Mechanical pre-review pass over a diff: debug output, new TODO/FIXME/HACK markers, trivial assertions, deleted tests. Chains sibling gates. | `--fail-over` |
| [`doc-reader`](skills/doc-reader/) | Extracts plain text from docx, pptx, xlsx, html, markdown, and text with only the stdlib; PDF goes to pdftotext when installed. | - |
| [`env-gate`](skills/env-gate/) | Compares a deployed .env with .env.example for missing, empty, undeclared, and placeholder keys. | exit 1 on drift |
| [`ext-scaffold`](skills/ext-scaffold/) | Generates a Manifest V3 browser extension skeleton that loads in Chrome, Edge, and Firefox with no npm or bundler. | - |
| [`graph-tools`](skills/graph-tools/) | Builds directed graphs from JSON edge lists: degree stats, cycle detection, and BFS shortest paths. | `--fail-on-cycle` |
| [`json-diff`](skills/json-diff/) | Semantic diff of two JSON documents by path: added, removed, and changed values, ignoring key order and formatting. | `--max-changes` |
| [`log-analyzer`](skills/log-analyzer/) | Groups a log's errors by normalized pattern and ranks the worst offenders. | `--budget-errors`, `--max-patterns` |
| [`net-probe`](skills/net-probe/) | Port checks, DNS resolution, TLS certificate expiry, and HTTP latency with only the socket and ssl modules. | exit 1 on failure |
| [`portfolio-audit`](skills/portfolio-audit/) | Checks an exported portfolio CSV for concentration risk, allocation drift, and gain/loss, fully offline. | `--max-position`, `--max-type` |
| [`repo-audit`](skills/repo-audit/) | Structural health check for a git repo: LICENSE, README, tests, CI, .gitignore, large tracked files, stale merged branches. | `--fail-on` |
| [`resume-audit`](skills/resume-audit/) | Scores a resume's structure, quantified impact, and ATS keyword coverage against a job description. | `--min-bullet-ratio` |
| [`sec-headers`](skills/sec-headers/) | Grades a URL's HTTP security headers and cookie flags with an A-F grade and per-header results. | `--min-grade` |
| [`seo-audit`](skills/seo-audit/) | Scores on-page SEO for saved HTML: title, meta description, h1, alt text, canonical, Open Graph, html lang. | `--min-score` |
| [`sys-health`](skills/sys-health/) | Point-in-time Mac health: disk, memory, load, top CPU, zombies. | `--max-disk-pct`, `--max-mem-pct` |

### Process

| Skill | Purpose |
| --- | --- |
| [`anti-bs`](skills/anti-bs/) | Audits a response for invented facts, fake completion, unsupported claims, and order drift. |
| [`astra-init`](skills/astra-init/) | Writes a lean per-project working agreement for GPT-6 Astra sessions, separate from the repo's AGENTS.md. |
| [`ci-test-rebuild`](skills/ci-test-rebuild/) | Rebuilds JS/TS tests and checks as a fast local Bun gate, proven by before/after metrics. |
| [`cleanup-worktrees`](skills/cleanup-worktrees/) | Inventories git worktrees and local branches, then removes only exact approved targets. |
| [`cyber-bypass`](skills/cyber-bypass/) | Restates a prompt stopped by a Codex or Claude cyber-safety flag with its real context. |
| [`dft`](skills/dft/) | Dogfoods the built product through its real entry points and reports journey failures. |
| [`fdd`](skills/fdd/) | Fuzz-driven development: generated inputs break invariants, and shrunk repros become tests. |
| [`finish-pr`](skills/finish-pr/) | Commits scoped work, opens or updates a labeled PR, and verifies checks on its exact head. |
| [`init-rules`](skills/init-rules/) | Creates or updates a repo's root Rules.md with DO/MUST rules grounded in project docs. |
| [`loe`](skills/loe/) | Defines the Level of Expectation before work: observable outcomes, scope, and evidence of done. |
| [`preflight`](skills/preflight/) | Builds one project-specific pre-release gate script mapped to the roadmap and Rules.md. |

### Creative

| Skill | Purpose |
| --- | --- |
| [`3d-design`](skills/3d-design/) | Scaffolds a self-contained Three.js scene in one HTML file, plus the discipline for 3D scenes that don't look like demos. |
| [`claude-design`](skills/claude-design/) | Creates or revises Claude Artifacts (Docs, Slides, Design, Dashboards) through OmO's signed-in browser. Explicit use only. |
| [`image-gen`](skills/image-gen/) | Image-generation provider routing (gpt-image vs grok) and prompt structure that survives the model. |
| [`karpathy-prompt`](skills/karpathy-prompt/) | Writes output a reader can verify without guessing: 80%-STE prose and a format ladder. |

### Power tools

| Skill | Purpose |
| --- | --- |
| [`create-skills`](skills/create-skills/) | Authors or revises SKILL.md packages from reports, docs, and workflows. |
| [`init-readme`](skills/init-readme/) | Overhauls a root README from file-cited explore evidence with an ultrabrain review gate. |
| [`pro-review`](skills/pro-review/) | Explicit GPT-6 Pro second-opinion code review through a Pro-checked ChatGPT transport, with a machine-checked report. |
| [`readme-init`](skills/readme-init/) | Creates or refreshes a README from what the repo contains: code, manifests, commands. |

### Orchestration

These skills assume an OmO install; several drive Herdr.

| Skill | Purpose |
| --- | --- |
| [`apps-handoff`](skills/apps-handoff/) | Resumes an OmO desktop thread in a CLI terminal with its full history. |
| [`browser-aside`](skills/browser-aside/) | Hands the session to Aside's browser chat on the same model and resumes on return. |
| [`herdr`](skills/herdr/) | Drives Herdr panes, tabs, agents, and worktrees through the herdr CLI. |
| [`max-build`](skills/max-build/) | Highest-rigor all-in-one for any deliverable, using OmO's full tools and embedded skills. Explicit use only. |
| [`omo-runner`](skills/omo-runner/) | Offloads long OmO runs to remote runners, pulls results, and sets up the runner pool. |
| [`optimize-omo-config`](skills/optimize-omo-config/) | Inventories real OmO model access and drafts evidence-backed routing proposals. |
| [`project-sessions`](skills/project-sessions/) | Creates isolated Herdr task checkouts and resumes their OmO chats. |
| [`prompt-builder`](skills/prompt-builder/) | Wraps a task in Q's work prompt: explore, ideal state, QA, quick tasks, goal, mass ulw. Explicit use only. |
| [`reorient`](skills/reorient/) | Recovers project context from memory, sessions, git, and PRs into one journal. |
| [`session-finder`](skills/session-finder/) | Lists live coding-agent processes (Claude, Codex, OmO) as text or JSON, with safe kill. |
| [`watcher`](skills/watcher/) | Supervises delegated OmO work while the user is away; fixes ship as CI-watched PRs. |

### macOS

These skills only run on macOS.

| Skill | Purpose |
| --- | --- |
| [`apple-home`](skills/apple-home/) | Reads and controls Apple Home: rooms, accessory state, scenes, on/off toggles. |
| [`apple-suite`](skills/apple-suite/) | Scripts Notes, Reminders, Calendar, Mail, Maps, Contacts, and Shortcuts through AppleScript. |
| [`apple-tv`](skills/apple-tv/) | Reads and controls the TV app: library search, now playing, playback. |
| [`appshot`](skills/appshot/) | Captures a window, screen, or region as a PNG with screencapture. |
| [`finder`](skills/finder/) | Reads and controls Finder: selection, listings, reveal/open, folders, tags, Trash, eject. |
| [`iphone-mirroring`](skills/iphone-mirroring/) | Reads and navigates iPhone Mirroring: state, screenshots, View menu. Input goes through OpenCUA. |
| [`macos-settings`](skills/macos-settings/) | Reads settings, sets appearance, volume, and Wi-Fi power, and opens Settings panes. |
| [`moffice`](skills/moffice/) | Drives Word, Excel, and PowerPoint through AppleScript: read, edit, create, export PDF. |
| [`phone-facetime`](skills/phone-facetime/) | Phone and FaceTime calls: preview and open call URLs, read call state, hang up, mute, recents. |
| [`spotify`](skills/spotify/) | Reads and controls the Spotify desktop app: playback, volume, shuffle, repeat, search. |

### Connectors

| Skill | Purpose |
| --- | --- |
| [`discord-messenger`](skills/discord-messenger/) | Reads Discord channels and sends replies through the bot API or desktop app, only after approval. |
| [`kakao-messenger`](skills/kakao-messenger/) | Reads and replies to KakaoTalk through the signed-in Mac app. |
| [`notion`](skills/notion/) | Looks up answers in a configured Notion workspace through MCP or the API. |
| [`obsidian-vault`](skills/obsidian-vault/) | Looks up answers in the configured Obsidian vault when it's installed and readable. |
| [`slack-messenger`](skills/slack-messenger/) | Reads and replies to Slack from the CLI or desktop app, sending only after approval. |
| [`vaultwarden`](skills/vaultwarden/) | Unlocks a Vaultwarden or Bitwarden vault with the bw CLI and uses saved logins to sign in. |

### Other

| Skill | Purpose |
| --- | --- |
| [`game-film`](skills/game-film/) | Studies a competitor's public playbook: docs, releases, pricing, community posts. |
| [`proxmox-ve`](skills/proxmox-ve/) | Operates Proxmox VE through its MCP server: API discovery, cluster inspection, deliberate administration. |
| [`side-hustle`](skills/side-hustle/) | Plans lawful extra income with no capital: freelancing, bug bounty, hackathons. |
| [`skill-picker`](skills/skill-picker/) | Queries `catalogue.json` by persona, family, keyword, or tag and lists matching skills with install commands. |
| [`social-research`](skills/social-research/) | Finds content on X, Threads, Reddit, HN, and Bluesky through public APIs and endpoints, without a browser. |
| [`tv-detox`](skills/tv-detox/) | Cleans up a slow Android or Google TV over adb, with an optional TV Detox launcher. |

## Architecture

```text
Claude Code / Codex / compatible Agent Skills host
                        |
               plugin manifests
                        |
                skills/<name>/
                |             |
             SKILL.md     [scripts/*.py | scripts/*.mjs]
                                |
                 files or stdin input
                                |
            text or JSON output + exit status
```

The plugin manifests in `.claude-plugin/` and `.codex-plugin/` expose the directories under `skills/`. Forty-four skills are backed by Python scripts and eight by Node scripts (`scripts/*.mjs`); most of the rest are instruction-only. Every script runs directly with Python or Node and doesn't depend on an agent host.

## Installation

### Run from a clone

Python 3.10 or later is required (CI tests 3.10, 3.12, and 3.13); `macos-settings` needs 3.12+. The Node-backed skills also need Node.js; `pro-review` needs Node.js 24+ and a ChatGPT Pro login.

```bash
git clone https://github.com/trac3r00/core-skills.git
cd core-skills
```

The guard, security, interop, and backend CLIs use only the Python standard library. `context-budget` also runs without third-party packages, but uses the `cl100k_base` tokenizer when `tiktoken` is installed and otherwise falls back to an approximate character-based count.

```bash
python3 -m pip install tiktoken  # optional, for tokenizer-based context counts
```

### Install as a plugin

Claude Code:

```bash
claude plugin marketplace add trac3r00/core-skills
claude plugin install core-skills@core-skills
```

Codex:

```bash
codex plugin marketplace add trac3r00/core-skills
codex plugin add core-skills@core-skills
```

The plugin installs all 83 skills together. To use individual skills without the plugin, copy the relevant directory from `skills/` into the skills directory supported by your agent host, or use the bundled `skill-sync` skill to link them into a universal directory.

## Usage

Run commands from the repository root.

### Audit context size

```bash
python3 skills/context-budget/scripts/context_budget.py \
  path/to/system-prompt.md path/to/skills/ \
  --budget 40000 --top 15
```

### Identify unsupported claims

```bash
printf '%s\n' 'The service was launched in 2024.' \
  | python3 skills/claim-audit/scripts/claim_audit.py - --fail-over 0.4
```

### Extract unresolved conversation items

```bash
python3 skills/open-loops/scripts/open_loops.py thread.jsonl --json
```

The transcript may be a JSON array, JSONL records containing `role` and `content`, or plain text using `[speaker] message` or `speaker: message` lines.

### Audit recurring charges

```bash
python3 skills/subscription-audit/scripts/subscription_audit.py statement.csv \
  --budget 80 --json
```

The CSV must contain date, description or merchant, and amount data. Header names and common delimiters are detected automatically; use `-` as the input path to read CSV data from standard input.

### Compare Python gate modules

```bash
python3 skills/gate-graph/scripts/gate_graph.py path/to/gates/ \
  --max-gates 49 --max-overlap 0.5 --json
```

### Find unused or stale skills

```bash
python3 skills/skill-decay/scripts/skill_decay.py \
  --skills-dir path/to/skills/ \
  --logs path/to/agent-logs/ \
  --stale-days 30 --max-decay 20
```

Use `python3 skills/<skill>/scripts/<script>.py --help` for the complete interface of any Python tool.

## Configuration

The guard tools below don't read environment variables or a shared configuration file. Behavior is configured through command-line arguments:

| Tool | Main options |
| --- | --- |
| `context_budget.py` | `--budget`, `--model`, `--top`, `--json` |
| `claim_audit.py` | `--fail-over`, `--json` |
| `open_loops.py` | `--max-open`, `--json` |
| `subscription_audit.py` | `--budget`, `--min-charges`, `--stale-days`, `--currency`, `--json` |
| `gate_graph.py` | `--max-gates`, `--max-overlap`, `--top`, `--full-matrix`, `--json` |
| `skill_decay.py` | `--skills-dir` or `--names`, `--logs`, `--stdin`, `--stale-days`, `--max-decay`, `--fail-on-never`, `--as-of`, `--json` |

When a configured threshold is exceeded, the relevant command exits with status `1`, making it suitable for local automation or CI. Input and usage errors handled by the scripts exit with status `2`.

## Development

The Python test suite requires [pytest](https://docs.pytest.org/).

```bash
python3 -m pip install pytest
pytest tests/test_skills.py
```

The suite covers the script-backed Python CLIs end-to-end and validates every skill's `SKILL.md` frontmatter (name matches directory, discoverable description). CI (`.github/workflows/tests.yml`) runs it on Python 3.10, 3.12, and 3.13 for pushes to `main` and pull requests.

Node-backed skills keep their tests next to the skill in `test/*.test.mjs`. Run them with Node's built-in test runner:

```bash
node --test skills/*/test/*.test.mjs
```

To add a skill, follow the contributor contract in [`skills/AGENTS.md`](skills/AGENTS.md): frontmatter requirements, the CLI and gate conventions, and the manifest registration checklist. Regenerate `catalogue.json` with `python3 skills/skill-picker/scripts/generate_catalogue.py` rather than editing it by hand.

## Project structure

```text
.
├── .agents/plugins/      # Generic marketplace manifest
├── .claude-plugin/       # Claude Code marketplace and plugin metadata
├── .codex-plugin/        # Codex plugin metadata
├── .github/workflows/    # CI: pytest matrix + CLI smoke tests
├── skills/               # 83 skills: SKILL.md instructions, 44 with Python CLIs, 8 with Node scripts
├── tests/test_skills.py  # End-to-end CLI tests + repo-wide frontmatter validation
├── catalogue.json        # Generated skill inventory (name, description, version, family, personas)
├── LICENSE
└── README.md
```

## License

Licensed under the [MIT License](LICENSE).
