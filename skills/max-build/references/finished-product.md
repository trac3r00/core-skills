# Finished-Product Bar & Continuous Optimization Hunt

Read in Phase 0, Phase 4, and Phase 6 of EVERY build run. The user is asking
for a **real, shippable finished product** — never an example codebase, a
demo stub, or "slop code that barely passes the happy path" — and wants every
run to actively hunt for meaningful improvements and optimizations.

## 1. Finished Product vs. Example / Slop Code

Unless the user explicitly asks for a throwaway prototype or spike, reject
demo-grade shortcuts and hold every deliverable to the Finished-Product Bar:

| Dimension | Example / Slop (REJECT) | Finished Product (SHIP) |
| --- | --- | --- |
| **Wiring & data flow** | Hardcoded sample arrays, mock responses wired into prod code, `TODO: connect later`, stubbed handlers | Real end-to-end integration with actual storage, config, auth, IPC, APIs, or filesystem boundaries |
| **Error & edge handling** | Happy-path-only code, bare `catch {}`, generic `"Something went wrong"`, crashes on empty/null/bad input | Typed boundary validation, actionable error messages, clean exit codes, safe retries/timeouts, graceful degradation |
| **UI & UX completeness** | Default template cards, desktop-only layout, missing empty/loading/error states, broken dark mode or keyboard focus | Cohesive visual hierarchy, responsive desktop + mobile, every state designed (default, empty, loading, error, long text), verified via real screenshots |
| **CLI / API ergonomics** | Missing `--help`, mixed stdout/stderr, undocumented flags, inconsistent JSON error shapes | Clean help/usage, strict stdout (data) vs stderr (errors), deterministic exit codes, documented contracts |
| **Architecture & craft** | Monolithic dump file, copy-pasted blocks, speculative wrapper layers, dead imports/files left behind | Deep cohesive modules fitted to repo conventions, minimal moving parts, zero dead code or orphan files |
| **Testing & verification** | Mocked-into-agreement unit tests, unrun commands, "should work" prose | Red->green tests at public seams, property/edge tests where relevant, live real-surface execution with captured receipts |
| **Operations & handoff** | Breaks on fresh clone, undocumented env vars, stale README/changelog/catalogs | Clean build/typecheck/tests, idempotent setup, rollback path for risky changes, every stale adjacent doc/script updated |

**Simplicity != Shortcuts:** Karpathy's *Simplicity First* means **zero
unnecessary complexity or speculative bloat**, never omitting real error
handling, real wiring, or real UX states required for a finished product.

## 2. Pre-Ship "Is This Actually Finished?" Checklist

Before declaring PASS, run this five-question test on the deliverable:

1. **Cold-start test:** If a real user or teammate ran this right now with no
   coaching and gave it messy/empty/unexpected input, would it behave cleanly
   from start to finish?
2. **Zero-placeholder grep:** Did any `TODO`, `FIXME`, `placeholder`,
   `stub`, `mock`, hardcoded localhost/sample data, or debug log leak into
   shipped production paths?
3. **Full lifecycle check:** Are create, read, update, delete, cancel, retry,
   shutdown, and cleanup paths all complete where the feature owns them?
4. **Real-surface proof:** Did you personally execute the built artifact as the
   user will (real HTTP call, real CLI invocation, real rendered page/TUI,
   real document/media inspection) and observe the real output?
5. **No leftover mess:** Are all adjacent tests, types, builds, CI hooks,
   docs, and mirrors synchronized and all scratch files/processes cleaned up?

## 3. Continuous Improvement & Optimization Hunt (Every Run)

Do not merely complete the literal ticket and walk away. On every run, perform
a disciplined **Improvement & Optimization Pass** across five targets:

| Target | What to hunt for | Action rule |
| --- | --- | --- |
| **1. Codebase & architecture** | Duplicated logic, leaky seams, hot-path allocations, blocking sync calls, brittle coupling, dead exports | Fix inside touched files immediately (within surgical scope); rank out-of-scope systemic debt in **Core issues & next leverage**. |
| **2. Tests & CI speed/reliability** | Full-suite runs where affected-only works, uncached jobs, missing `cancel-in-progress`, flaky sleeps/polls, weak/slow E2E replaceable by contract tests | Fix directly when in scope (measure before/after on same machine); otherwise propose the exact ranked Tier 1-3 upgrade ([qa-testing-ci.md](qa-testing-ci.md)). |
| **3. Agent, token & turn efficiency** | Verbose raw logs entering context, repeated unbatched tool calls, missing reusable scripts/levers, uncached prompt churn | Apply Code Mode batching + structured failure digests now; build a small reusable script when an operation repeats. |
| **4. Product & UX polish** | Rough edge states, confusing errors, missing keyboard/a11y/mobile polish, slow perceived latency | Polish inside the deliverable before shipping so it feels genuinely finished. |
| **5. Security & resilience** | Unpinned CI actions, broad token permissions, missing boundary validation, silent failures, missing rollback paths | Harden in-scope surfaces immediately; flag adjacent risks explicitly once. |

**Discipline:**
- **In-scope optimizations:** ship them cleanly when they are surgical,
  provably better (measured or clearly simpler per Karpathy's Simplicity
  Criterion), and introduce zero regression.
- **Out-of-scope optimizations:** never silently rewrite unrelated modules;
  present the top 1-3 highest-leverage improvements in **Core issues & next
  leverage** with *evidence -> impact/effort -> exact next move* so the user
  can greenlight them in one word.
