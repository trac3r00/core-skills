# Deep Research, Web Access, and Browser Execution (Embedded)

Read whenever TASK requires deep investigation, competitive/technical research,
primary-source verification, web interaction, or reaching blocked/bot-scored
or platform-locked sources. This embeds the core operational playbooks of
`ulw-research`, `ultimate-browsing`, and `browser` so `max-build` runs
them natively without switching skills.

## 1. Deep Research Playbook (Embedded `ulw-research`)

Use this when the deliverable is a researched verdict, deep investigation, or
multi-source technical decision where under-exploration is the failure mode.

### Orchestration & Saturation Loop
1. **Scope solo first:** break the question into disjoint research axes,
   canonical entities, required format, and open unknowns before spawning
   anyone.
2. **Default team + read-only lanes:** stand up a cooperating `team_create`
   (mixed cost tiers: cheap breadth, stronger skeptic/synthesizer, `writing`
   for final language polish) for multi-axis saturation, plus background
   `explore` / `librarian` `task` lanes for code/docs (curated read-only
   agents cannot join teams). Every worker gets ONE unique angle and broadcasts
   leads, findings, and dead ends immediately (`task_send({ to: "lead" })`)
   with an `EXPAND` tail.
3. **Search craft:** English-first for global technical/docs corpora, then
   local-language sweeps where relevant. Vary operators (`site:`, `filetype:`,
   `intitle:`, `"exact"`, `-term`, `OR`, `after:`); never send two workers
   on the same query. Check `x_search` via `tool_search` when social/recency
   evidence matters, and reconcile social-only claims against primary web
   sources before accepting them.
4. **Convergence:** chase every non-duplicate `EXPAND` lead across >=2
   expansion waves until leads run dry or dead ends are proven by tool output.
   Keep excursions bounded by explicit ENTER/EXIT triggers and fold every
   excursion back into the top-level answer (or `none`).
5. **Code-settles-code (Phase 4):** whenever sources disagree, behavior is
   undocumented, or a claim is performance/compatibility-shaped, write and run
   a minimal self-contained script to prove or refute it with captured stdout,
   versions, and OS.
6. **Epistemic locking & debate (Phase 4b):**
   - Maintain a structured claim table (`claim_id`, statement, risk tier,
     supporting/contradicting observations, source domains, temporal validity
     `observed_at`/`valid_at`, status: `supported | partial | refuted |
     unresolved`).
   - High-risk non-code claims clear into the verified allowlist only with:
     >=2 independent source domains (or explicit primary-only exception),
     >=1 counter-search looking for refutation, primary-source backing, and
     explicit temporal validity.
   - Run an explicit **skeptic debate round** attacking every contested or
     headline claim; log attack, defense, and verdict. Move anything failing
     the bar to an `Unresolved / Refuted` annex — abstention beats guessing.
   - Keep `MEASURED`, `ASSUMED` (with rationale), and `DERIVED` (with
     formula + sensitivity) numbers visibly distinct.
7. **Visual, verified synthesis & teardown:**
   - Lead with an executive summary, themed findings with inline `[Source N]`
     citations and short verbatim quotes (<20 words), ranked sources with
     access dates, debate/contradiction record, and gaps.
   - For quantitative findings, build real data tables (DuckDB/Polars/NumPy)
     and render crisp charts/Mermaid diagrams; when `show_html_page` is
     available and a structured visual report reads better than plain chat,
     deliver the gated inline HTML report plus a concise chat summary.
   - Tear down every team (`team_delete({ team_run_id, force: true })`) and
     confirm all lanes are terminal before closing.

## 2. Web Access Escalation Ladder (Embedded `ultimate-browsing` + `browser`)

Start at the cheapest tier that can reliably read or operate the target and
climb only when a cheaper tier fails or lacks required interaction:

| Tier | When to use | How to execute |
| --- | --- | --- |
| **0. Built-in / Direct** | Plain search, static unblocked docs, library APIs | `context7` MCP (library docs), `web_search`, `webfetch`, or `fetch` inside `eval` |
| **1. Headless WAF & Media** *(insane-search)* | 403 / Cloudflare / WAF-blocked pages, archive snapshots, YouTube/Vimeo/TikTok subtitles & metadata | Run the host's `ultimate-browsing` engine (`python3 -B -m engine "<URL>" --json` from its skill dir), `yt-dlp --write-sub --skip-download`, or official public JSON endpoints (Reddit `.json`, HN Firebase, arXiv, GitHub `gh`). Tag archive surrogates with their `snapshot_timestamp` — never present a snapshot as live. |
| **1.5 Platform-Native Readers** *(agent-reach)* | Chinese & social platforms (Douyin, Bilibili, V2EX, Weibo, XHS, WeChat), podcasts, GitHub/LinkedIn | Use native APIs/CLIs (`gh`, V2EX JSON API, `yt-dlp` for Bilibili, `mcporter`/configured Jina or social channels where credentials exist). |
| **2a. Owned Real Browser** *(omowright owned / Bun.WebView)* | JS-rendered public pages, local web QA, screenshots, bot-scored hosts needing stealth + interaction | Use `new Bun.WebView()` for fast local/public layout measurement, or load host `omowright` (`connectPipe` with a task-owned profile dir, or `connectCloakProfile` for WAF/bot-scored targets). Use `compactSnapshot` + `createNetworkSnoop` to read real API JSON rather than fragile DOM scraping. Always `browser.close()` and remove the task-owned profile dir in `finally`. |
| **2b. Attached User Browser** *(omowright attached / standing browser)* | Sites the user is already signed into, open tabs, authenticated web QA, flows blocked on headless | Use `connectBrowserSkill()` -> `session.cooperate("sync")` -> `session.navigate` / `bskSnapshot` / `session.observe` / `session.click` -> `session.stop()`. Respect any user standing browser preference (e.g. Aside/Brave). |

### Hard Browser Safety & Honesty Rules
- **NEVER** clone, launch against, or clear cookies/cache/site data on the
  user's real browser profile (it invalidates their active sessions).
- **NEVER** fall back to a headless/owned browser for an authenticated user
  criterion; if the attached browser bridge is unavailable, guide the user
  through the one-step reconnect.
- **Stealth is not proof of access:** inspect the rendered snapshot/screenshot
  and report any remaining CAPTCHA, login wall, or challenge honestly.
- **No cookie leakage:** store any task-owned automation cookies with `0600`
  permissions outside shared `/tmp` and never commit or log them.
