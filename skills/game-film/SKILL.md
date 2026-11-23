---
name: game-film
description: "Study a competitor's public playbook: docs, releases, pricing, community posts. Use when asked to game-film a competitor. Not for broad research (ulw-research)."
version: 1.1.0
license: MIT
metadata:
  agentskills:
    tags: [competitor-research, product, strategy, research]
---

# Game Film

In sports, you watch the opponent's actual possessions to learn how they move, decide, and adjust.
For software, that means reconstructing another project's public playbook from what it ships, says,
prices, hires for, and how its community reacts. The output is a scouting report, not a press-release
summary.

## Inputs and default

Establish:

- target project and any aliases;
- the scouting question: what they optimize for, where they are going, where they are weak, or what
  they will ship next;
- time window (default: last 90 days, with older context only where it explains a move);
- market and audience;
- depth: quick scan (one session) or full film (multi-source, with evidence log);
- whether the user has a local artifact for the separate `rea` workflow.

If the target or question is ambiguous, ask one material question. Otherwise state the reading and
start.

## Evidence rules

1. **Public and authorized only.** No private accounts, leaked material, unauthorized access, or
   testing the target's systems. A public page behind a login is not public evidence unless the user
   is authorized and the page is read through their own session.
2. **Every retained claim has a source, date, type, and confidence.** Type is `official`,
   `community`, `third-party`, or `local artifact`.
3. **Observed vs inferred.** "They shipped X on date Y" is observed. "They are moving upmarket" is an
   inference; state the signals behind it.
4. **No invented quotes or numbers.** Quote with a link and date. Do not turn a paraphrase into a
   quotation. Do not infer revenue, users, or growth from a single post.
5. **Cover gaps honestly.** "No public roadmap found" is a finding. Do not fill it with speculation.

The full source map and query patterns are in [references/source-map.md](references/source-map.md).

## Collect

Use this order so the film is anchored in primary evidence before community interpretation:

1. **Official surface**: site, docs, changelog, releases, roadmap, status page, pricing, security
   advisories, app-store listings, API docs, SDKs, package registries.
2. **Repository surface**: commits, pull requests, issues, discussions, labels, milestones, release
   cadence, deprecations, contributor changes.
3. **Commercial surface**: pricing changes, packaging, free tier, limits, overage, discounts,
   partnerships, funding, earnings, job postings.
4. **Community surface**: X, LinkedIn, Reddit, Hacker News, YouTube, Product Hunt, review sites,
   public Discord/Slack archives, forums, Chinese platforms when relevant.
5. **Customer surface**: reviews, complaints, migration stories, workarounds, support threads,
   unanswered issues.
6. **Local artifact** (only when the user explicitly invokes `rea`): bundled strings, feature flags,
   local APIs, file formats. See "Work with REA" below.

For blocked or bot-scored public pages, use `ultimate-browsing` at the cheapest tier that reaches
them. For a page the user's own browser can open, use the `browser` skill's attached engine. Do not
use stealth tooling to bypass authentication or a hard block.

## Analyze

Build a move timeline first:

| Date | Move | Type | Evidence | What changed for the user | Signal |
| --- | --- | --- | --- | --- | --- |
| ... | release / price / hire / campaign / policy | official/community | link | ... | ... |

Then code the playbook through these lenses:

- **Product cadence**: release frequency, scope, breaking changes, deprecations, migration cost.
- **Pricing and packaging**: tiers, limits, overage, free tier, enterprise motion, discount patterns.
- **Positioning**: who they serve, who they ignore, the language they use, the comparisons they invite.
- **Distribution**: community, content, SEO, integrations, partnerships, app stores, developer relations.
- **Roadmap signals**: public roadmap, docs stubs, "coming soon", hiring, PRs, issue labels, founder
  replies. Separate official commitments from inferred direction.
- **Community sentiment**: repeated praise, repeated complaints, churn/migration stories, unanswered
  issues, moderator behavior, response time.
- **Moat and weakness**: data, integrations, switching costs, trust, support, price, platform risk.
- **Decision pattern**: inventor or fast follower, open or closed, centralized or modular, broad or
  narrow, loud or quiet.

## Produce the film

Use [assets/game-film-template.md](assets/game-film-template.md). The report must contain:

1. **One-screen verdict**: the opponent's current game, the direction of travel, and the one thing
   that would change the read.
2. **Timeline**: dated moves with sources.
3. **Playbook**: how they decide and execute, with evidence.
4. **Roadmap signals**: official vs inferred, with confidence.
5. **Community read**: what users love, hate, and work around, with links.
6. **Strengths and weak spots**: what is hard to copy and what is fragile.
7. **Counter-play**: three options with cost, risk, time-to-signal, and what evidence would confirm
   or kill each.
8. **Open questions**: gaps that need a source, an interview, or a local artifact.

Keep the one-screen verdict short enough to paste into a planning note. Put the evidence log in an
appendix or a separate file.

## Work with REA

`rea` is explicit-only local reverse engineering. Game-film does not invoke it, generalize its
permission, or treat a public target as a local artifact.

When the user explicitly invokes `$rea` on a local build they are authorized to inspect:

- ask REA for the narrowest implementation evidence that answers the scouting question;
- record the artifact path, version, hash if available, and the exact REA evidence identifier;
- label the finding `local artifact` and keep it separate from public evidence;
- do not test the target's hosted services, bypass authentication, or copy private user data.

If REA is unavailable, say which question remains unanswered rather than guessing the implementation.

## QA before delivery

- Every material claim has a link or an evidence identifier and a date.
- Every inference names its signals.
- No quote is invented or stripped of context.
- No private data, credential, or personal information is included.
- The roadmap section separates official commitments from inference.
- The counter-play options are falsifiable: each names the evidence that would confirm or kill it.
- The report names its gaps and the next source to collect.

## Stop condition

Stop when the scouting question is answered from public evidence (or explicitly marked unanswered),
the timeline and playbook are traceable, the counter-play options are falsifiable, and no unauthorized
access was used. If a source is blocked or a credential is missing, name it and deliver the partial
film with the gap.
