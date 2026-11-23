# Embedded OmO Skill Playbooks (Self-Contained All-in-One)

Read the matching section below in Phase 0/3/4/5 instead of switching to or
spawning separate skills. This distills the operational core of OmO's crucial
engineering, design, data, git, orchestration, and review skills directly into
`max-build`. (If a specialized host helper script exists inside a host skill
directory — e.g. `omowright.mjs`, `ast_grep_helper.py`, or `report-tools.mjs` —
invoke it directly; no need to surrender control of the run.)

## 1. Production Code Craft (`programming` + `refactor` + `ast-grep` + `lsp-setup`)

- **Ownership mindset:** fit new behavior into the existing architecture; fix
  root-cause defects in code you touch now; leave zero duplicate or dead code.
- **Type & error discipline (TS/JS, Python, Rust, Go):**
  - Use explicit typed errors / discriminated unions; never swallow exceptions
    or return silent `null`/`undefined` on failure.
  - Exhaustive matching on variants; make illegal states unrepresentable.
  - Validate untrusted data at system boundaries only; trust internal invariants.
- **Structural code-smell tripwires:**
  - Watch for bloated files (>250-300 LOC doing multiple unrelated jobs),
    functions taking >3-4 positional parameters (use an options object/struct),
    negative-form boolean names (`isNotDisabled`), and redundant post-action
    checks that duplicate the operation's own error semantics.
- **Refactoring safety:** lock existing public-seam tests green *before* moving
  code; use `lsp_find_references` / `lsp_prepare_rename` / `lsp_rename` for
  symbols and `ast-grep` (`sg` / `ast_grep` MCP) for syntax-shape searches
  and dry-run-first codemods across files (never brittle regex over ASTs).
- **Missing LSP?** Detect language server availability first; if diagnostics
  are unavailable for the edited language, configure/verify the server or run
  the language's native strict typechecker (`tsc --noEmit`, `pyright`,
  `cargo check`, `go vet`) before claiming clean diagnostics.

## 2. Hypothesis-Driven Debugging (`debugging`)

1. **Runtime truth beats code reading:** every causal claim must come from
   observed state (trace, debugger, failing repro, log, wire capture), never a
   plausible story inferred from source alone.
2. **Tight repro loop first:** build a minimal deterministic pass/fail
   reproducer before editing production code.
3. **Orthogonal oracle angles:** when a bug resists two fixes on one premise,
   stop, write the premise down, and test it directly via an orthogonal angle
   (git bisect, differential run, isolated minimal script, memory/network/IPC
   probe, or binary inspection via `rea` MCP).
4. **Leave no trace:** journal every temporary debug print, fixture, or
   instrumentation file and remove it before verifying the final state.

## 3. Frontend Design, Visual QA & Inline Visualizations (`frontend` + `visual-qa` + `visualize`)

- **Flow:** Ground (product purpose & real users) -> Brief (what this screen is
  for, primary action, every state) -> Build -> Subtract (remove anything on
  screen without a job) -> Verify.
- **Craft bar:** clear visual hierarchy, one obvious primary action, deliberate
  typography/spacing/color tokens, full light & dark theme support where
  relevant, keyboard navigation & accessible contrast, and every state designed
  (**default, empty, loading, error, overflow/long text**). Reject generic AI
  card-soup templates and unmotivated glow/gradient clutter.
- **Dual-oracle Visual QA:**
  - *Machine check first:* measure bounding boxes, horizontal overflow, text
    clipping, broken images, contrast, and console/network errors in code via
    `Bun.WebView` or `omowright`.
  - *Human-eye check second:* capture screenshots at desktop (~1440px) AND
    mobile (~390px) widths (plus light/dark if supported), inspect the pixels
    directly, fix visual defects, and re-capture after changes. Reading HTML/CSS
    source is never visual QA.
  - For TUI surfaces, render through a real PTY + browser terminal capture;
    never trust `tmux capture-pane` for truecolor or wide-glyph/CJK layout.
- **Inline visual explanations (`visualize`):** when a chart, table, diagram,
  or interactive view answers the user faster than prose, build a crisp
  self-contained single-file HTML page matching the reader's theme and display
  it via `show_html_page`.

## 4. Data, Benchmarks & Eval Integrity (`data-scientist` + `eval-integrity`)

- **Resident-kernel data work:** stay inside the persistent `py` (DuckDB for
  joins/window/aggregations, Polars for fast transforms, NumPy for numeric
  computation; avoid pandas handoffs unless required) or `js` kernel; keep
  large datasets in kernel memory/disk and print only verified aggregates.
- **Eval & benchmark audit:** before trusting any benchmark, A/B comparison,
  or LLM-judge score, verify (1) exact claim vs metric alignment, (2) ground
  truth & contamination/leakage, (3) independence (no shared bug, no test
  mutation, clean restore between mutants), and (4) sample size, noise floor,
  and statistical/pass^k bounds. Report an unambiguous verdict (`PASS`,
  `FAIL`, or `INCONCLUSIVE`) with caveats.

## 5. Anti-Slop Cleanup & Gate Review (`remove-ai-slops` + `review-work`)

- **Five slop classes to strip before shipping:**
  1. *Stylistic:* narrating-the-obvious comments, robotic preambles, AI buzzwords.
  2. *Structural:* speculative single-use abstractions, wrapper-of-a-wrapper,
     dead branches, copy-pasted logic instead of reusing existing helpers.
  3. *Hidden cost:* redundant I/O, N+1 loops, unbounded context dumps,
     unnecessary dependencies or config files.
  4. *Test slop:* prose/wording pinning, mock-call assertions that cannot fail,
     fixtures equal to defaults, sleeps/timing luck, testing private internals.
  5. *Size/scope bloat:* unrelated drive-by refactors outside TASK's scope.
- **Gate Review protocol (M/L or high-risk code):**
  1. Run real-surface manual QA yourself first (live CLI/API/UI/TUI with
     captured evidence) — never hand untested code to a reviewer.
  2. For M/L code deliverables or explicit review requests, spawn ONE
     independent `omo-native-gate-reviewer` with goal, acceptance criteria,
     diff, and QA receipts, after the lens-separated Adversarial QA Panel
     ([adversarial-qa.md](adversarial-qa.md)); never duplicate generic reviewers.
  3. Fix every criterion-cited blocker and re-verify only the delta (max 2
     re-reviews); log non-blocking notes with keep/decline rationale.

## 6. Durable Loops, DAG Workflows, Adversarial Planning & Multi-Device (`ulw-loop` + `mass-ulw` + `hyperplan` + `dag-library` + `omo-relay`)

- **Durable goal loops (`ulw-loop`):** for multi-turn/long work, register a
  concrete `create_goal` with binary stop criteria, keep an append-only
  ledger/notepad that survives context compaction, and never mark `blocked`
  while a live monitor or child notification can still wake the run.
- **Dependency DAGs (`mass-ulw` + `dag-library`):** use plain parallel
  `task` batches for independent disjoint units; reach for `tool.workflow`
  only when real task dependencies exist (C needs A + B). Save repeatable
  multi-agent graphs as named JSON definitions when the user will re-run them.
- **Adversarial planning (`hyperplan`):** reserve for irreversible one-way
  doors (major architecture, security, migrations) at top-level lead only:
  pit competing roles (skeptic, validator, architect, researcher) against the
  plan and keep only insights that survive attack.
- **Multi-device fleet (`omo-relay`):** when work targets another machine or
  peer session, use the OmO fleet SDK (`bunshin`) and `tool.thread_*`
  (`thread_list` first; paste returned thread links rather than raw IDs).

## 7. Git, Repo Docs & Session Forensics (`git-master` + `init-deep` + `coding-agent-sessions`)

- **Git discipline:** never commit unless explicitly asked. Before committing
  or rebasing, read `git log --oneline -20` + path history to mimic local
  conventions; keep commits atomic and green; respect `core.bare=true` repos
  (`git --git-dir=.git --work-tree=.`) and preserve unrelated dirty hunks.
  Use `git bisect`, `git log -S`, and `git blame` for root-cause forensics.
- **Repo agent docs (`init-deep`):** when a repo lacks usable `AGENTS.md`
  guidance and the user asks to document it, generate concise, verified
  hierarchical docs grounded in real commands and file structure.
- **Session forensics (`coding-agent-sessions`):** when memory + git leave a
  prior decision unexplained, search local session logs with targeted filters
  and extract exact quotes/paths rather than guessing.
