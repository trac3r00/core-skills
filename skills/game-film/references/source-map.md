# Source map for a software game film

Use the categories below as a checklist, not as a quota. A category with no public evidence is a
finding: record "no public evidence found" and move on.

## Official product surface

| Category | What to read | Useful signals |
| --- | --- | --- |
| Site and docs | Homepage, docs, guides, API reference, migration guides | Audience, positioning, supported surfaces, deprecation policy |
| Changelog and releases | Changelog, GitHub/GitLab releases, app-store release notes | Cadence, scope, breaking changes, "coming soon" |
| Roadmap | Public roadmap, milestones, issue labels, docs stubs | Committed vs aspirational, sequencing |
| Status and trust | Status page, incident history, security advisories, trust center | Reliability, disclosure posture, enterprise readiness |
| Pricing | Pricing page, billing docs, limits, overage, free tier | Packaging, expansion motion, discount patterns |
| Stores | App Store, Play, Chrome Web Store, VS Code Marketplace | Ratings, review themes, update cadence |
| Developer surface | API docs, SDKs, npm/PyPI/crates, OpenAPI, webhooks | Integration strategy, platform bets |
| Legal and policy | Terms, privacy, acceptable use, subprocessors | Compliance posture, enterprise blockers |

## Repository surface

- Commits and release tags: cadence, release size, reverts, hotfixes.
- Pull requests: review latency, contributor mix, design discussions, rejected directions.
- Issues and discussions: top complaints, maintainer responses, labels, closed-as-wontfix.
- Milestones and projects: promised dates and what slipped.
- Security advisories: response time and severity handling.
- Contributor and sponsor changes: team growth, funding, ownership.

## Commercial surface

- Pricing changes and grandfathering.
- Packaging changes: seats, usage, credits, enterprise tiers.
- Funding, earnings, partnerships, acquisitions.
- Job postings: teams being built, locations, technologies, seniority.
- Conference talks, founder interviews, podcasts, public letters.
- Patents, lawsuits, regulatory filings where public.

## Community surface

- X/Twitter: launch posts, replies, complaints, founder engagement.
- LinkedIn: hiring, executive posts, enterprise case studies.
- Reddit: subreddit threads, competitor comparisons, migration stories.
- Hacker News: launch threads, criticism, founder responses.
- YouTube/TikTok: demos, reviews, tutorials, comment sentiment.
- Product Hunt: launch positioning, comments, repeat launches.
- G2/Capterra/TrustRadius: review themes, switching reasons, pricing complaints.
- Public Discord/Slack/forum archives: support load, moderator behavior, feature requests.
- Chinese platforms when relevant: Xiaohongshu, Zhihu, V2EX, Bilibili, Weibo. Use the native readers
  in `ultimate-browsing` Tier 1.5 before a browser.

## Customer surface

- Reviews with dates and versions.
- Support threads and unresolved issues.
- Migration posts and "we switched to X" stories.
- Workarounds and third-party tools built around a gap.
- Pricing complaints and contract terms.
- Churn signals: deleted accounts, export requests, community moderation.

## Query patterns

Replace `<product>` with the actual name and add the year when the index is noisy.

```text
site:reddit.com "<product>" (complaint OR alternative OR switched)
site:news.ycombinator.com "<product>"
"<product>" changelog
"<product>" roadmap
"<product>" pricing change
"<product>" "breaking change"
"<product>" "coming soon"
"<product>" deprecation
"<product>" hiring
"<product>" founder interview
"<product>" review
```

For GitHub:

```text
repo:<owner>/<repo> is:pr is:merged sort:updated-desc
repo:<owner>/<repo> is:issue label:roadmap
repo:<owner>/<repo> is:issue "wontfix"
```

For package registries, read the package metadata, release dates, download counts if published, and
the repository link. Download counts are a signal, not a revenue estimate.

## Evidence log

Keep one row per claim:

```text
date | source URL | type | claim (one sentence) | confidence | used in section
```

Confidence:

- `high`: primary source, directly observed, recent enough for the claim.
- `medium`: primary source with an inference, or a credible third party with a dated observation.
- `low`: community report, stale source, or a single anecdote.

Do not average away disagreement. Record the strongest opposing evidence and the unresolved gap.

## Blocked sources

- Try the cheapest route first: official API, public JSON, RSS, archive snapshot.
- Use `ultimate-browsing` for a WAF, 403, or bot-scored public page.
- Use the `browser` skill's attached engine for a page the user's own browser can open.
- Do not bypass authentication, paywalls, CAPTCHAs, or rate limits. If the source requires an account
  the user is not authorized to use, mark it unavailable.

## Local artifact

Only after the user explicitly invokes `rea`:

- record the artifact path, version, hash, and REA evidence identifier;
- label findings `local artifact`;
- do not test hosted services or copy private user data;
- keep local findings separate from public claims in the report.
