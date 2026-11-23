# Situations: picking size, embedded playbooks, and surfaces fast

Read in Phase 0 alongside [history-memory.md](history-memory.md) and
[omo-features.md](omo-features.md). Pick every row TASK matches; rows stack.
Core workflows live inside `max-build`'s own references so you do not need to
switch skills for routine coding, research, browsing, UI, data, git, or QA.
Load an external custom skill only when a specialized domain adapter (e.g.
`opencua`, `vaultwarden`, `moffice`, `pptx`, `ci-test-rebuild`) is needed,
and always honor standing choices in memory or agreements.

## By intent

| Situation | Usual size | Embedded playbook / custom adapter | Proof surface | Adjacent artifacts to check |
| --- | --- | --- | --- | --- |
| Question, explanation, "look into" | S | [history-memory.md](history-memory.md), [research-browsing.md](research-browsing.md) Tier 0 | cited file:line, command output, or primary source | none: no edits |
| Review or opinion | S | [embedded-playbooks.md](embedded-playbooks.md) #4-#5, [judgment.md](judgment.md) | findings reproduced by a run | none until confirmed |
| Bug fix | S-M | [embedded-playbooks.md](embedded-playbooks.md) #1-#2, [history-memory.md](history-memory.md) | failing repro first, then green; git history checked for reverts | regression test, changelog |
| Feature or full product build | M-L | [finished-product.md](finished-product.md), [embedded-playbooks.md](embedded-playbooks.md) #1, [karpathy.md](karpathy.md) | real-surface end-to-end run, public-seam tests, anti-slop & zero-placeholder check | tests, docs/*.md, README, examples, types, catalogs |
| Refactor or cleanup | M | [embedded-playbooks.md](embedded-playbooks.md) #1 & #5 (LSP + ast-grep + anti-slop) | behavior unchanged: tests green before and after | imports, docs naming moved symbols |
| UI, page, or TUI | M | [embedded-playbooks.md](embedded-playbooks.md) #3, [finished-product.md](finished-product.md) | machine box/overflow check + desktop/mobile screenshots inspected | component docs, screenshots |
| Parser, codec, protocol, state machine | M | [embedded-playbooks.md](embedded-playbooks.md) #1, [oracles.md](oracles.md) | calibrated property campaign with counts & shrunk repros | regression corpus, contract docs |
| Tests or CI slow, flaky or bloated | M | [qa-testing-ci.md](qa-testing-ci.md), [karpathy.md](karpathy.md), `ci-test-rebuild` | before/after timings on same machine, V0-V3 budgets, failure digests | CI config, test scripts, docs |
| Optimization, perf, or eval hill-climbing | M-L | [karpathy.md](karpathy.md) autoresearch loop, [embedded-playbooks.md](embedded-playbooks.md) #4 | fixed-budget baseline, immutable oracle, keep/discard TSV ratchet | benchmark scripts, perf docs |
| Deep research or contested investigation | M-L | [research-browsing.md](research-browsing.md) #1 (embedded `ulw-research`) | team saturation, claim graph, code-verified claims, debate log, inline visual report | synthesis + cited report |
| Blocked URL, Cloudflare/WAF, signed-in web | S-M | [research-browsing.md](research-browsing.md) #2 (embedded `ultimate-browsing` + `browser`) | observed snapshot/screenshot/JSON proof, snapshot timestamps | none |
| Docs, skills, or prompts | S-M | `karpathy-prompt`, `create-skills` | contract tests, all cross-file links resolve, claims traced to runs | skill catalog, README, installed mirror |
| Release, PR, commit | S | [embedded-playbooks.md](embedded-playbooks.md) #7, `finish-pr`, `preflight`, `dft` | checks green on exact head, dogfood journey | changelog, version, release notes |
| Data or analysis | S-M | [embedded-playbooks.md](embedded-playbooks.md) #3-#4 (DuckDB/Polars/NumPy + `show_html_page`) | numbers recomputed from source tables | charts, report figures |
| Mac app or desktop automation | S | Computer use below (`opencua` standing choice) | app state observed after each action | none |
| Long, multi-phase or overnight | L | [embedded-playbooks.md](embedded-playbooks.md) #6 (`ulw-loop` + `mass-ulw` + `dag-library`) | per-phase checks, ledger receipts, clean teardown | plan file, ledger |
| Security, auth, payments, migrations | M-L, one-way door | [embedded-playbooks.md](embedded-playbooks.md) #1, #5, #6 (adversarial critique + gate review) | adversarial pass with runs, rollback verified | migration notes, rollback steps |

## Computer use and apps

Pick the most structured surface that can do the job, in order:

1. An app-specific scripted adapter (Office files, Notes, Reminders, Mail,
   Finder, music/TV apps): exact, fast, no screen reading.
2. Web pages: [research-browsing.md](research-browsing.md) (attached user
   browser / standing browser preference, or owned stealth engine for blocked
   public targets).
3. Desktop GUI with no scripting surface: the user's standing desktop-control
   tool (on this setup OpenCUA, formerly apple-cua: `opencua` MCP/skill).
   Never write ad-hoc input scripts or substitute another computer-use tool
   when a standing choice exists.
4. iPhone: `iphone-mirroring` or OpenCUA's iPhone tools.

Name the target app explicitly, observe state after each action, and confirm
before anything irreversible (sending, deleting, paying).

## Category, when a unit is delegated

See [delegation.md](delegation.md): stay local when batched `eval` cells are
faster/cheaper; otherwise start at the cheapest capable lane and escalate one
tier at a time on evidence.
