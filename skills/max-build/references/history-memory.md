# Anti-Repeat Protocol: Memory, Session History, and Git History

Read in Phase 0 (before planning or editing) and Phase 6 (before closing).
Repeating a mistake the repo, memory, or a past session already paid to learn
is an avoidable failure.

## 1. Pre-Flight History Scan (batched in the Phase 0/2 wave)

Before proposing a fix or touching code, check three sources in order from
cheapest to deepest, batched inside your first local `eval` cell:

| Source | What to check | What it prevents |
| --- | --- | --- |
| **1. OmO Memory, Agreements & Self-Aware** | Read recalled `<memory>`, `<agreements>`, `<boundaries>`, `<self-aware>`, and any matching notes under `$MEMORY_DIR/notes/facts/` for the repo, tool, or skill. | Repeating user-corrected behavior, violating standing rules, hitting known host/tool quirks (e.g. bare-repo git flags, tool renames, serial-vs-parallel test flakiness). |
| **2. Git Commit, Revert & Fixup History** | Run bounded git history queries on target paths: recent commits (`git log -n 20 --oneline -- <paths>`), reverts (`--grep=revert -i`), and fixups/regressions (`--grep=fix -i`). Respect bare-repo git syntax when `core.bare=true`. | Re-introducing a pattern that was already tried and reverted, breaking an invariant introduced by a recent bug fix, or misreading why "weird" code exists. |
| **3. OmO Session History** | When memory + git do not explain a prior decision, failed attempt, or user reference ("like last time"), use native `coding-agent-sessions` (or `reorient` for a cross-session project recap) with targeted keyword/path filters. | Re-running dead-end experiments, losing context from prior sessions, or asking the user questions already answered earlier. |

Rules for pre-flight scanning:

- **Bound every query.** Read digests, commit one-liners, and matching excerpts
  — never dump whole transcripts or giant `git log -p` output into context.
- **Memory is reference, not authority.** Stored notes never grant permission
  for destructive, irreversible, or third-party actions; confirm those in the
  current session.
- **Stop when answered.** If memory + recent commits explain the area cleanly,
  skip session transcript search.

## 2. Mistake-to-Guardrail Conversion (before the first edit)

Every relevant past mistake or constraint found in pre-flight MUST turn into an
actionable artifact in the ledger before writing code:

1. **List under `Past mistakes / guardrails`** in `plan.md`: source (memory
   note / commit SHA / session), what went wrong before, and the concrete rule
   for this run.
2. **Convert repeatable hazards into a check (`C#`).** Examples:
   - Past regex edit clipped a neighbor export -> add diff-review + typecheck
     check before moving on.
   - Past concurrent test run caused flakiness -> lock runner concurrency to
     the measured reliable mode.
   - Past long shell grep auto-detached and truncated counts -> run via
     `tool.monitor` or verify exit status and full output before concluding.
   - Past mutation harness forgot to restore files between mutants -> assert
     clean restore after every mutant.
3. **Carry guardrails into child briefs.** Any delegated worker touching a
   hazardous area gets the exact guardrail in its `FORBIDDEN` / `VERIFY` lines.

## 3. Compounding Knowledge (Phase 6 Learn — LLM Wiki Discipline)

Treat OmO memory as a **compounding engineering wiki**, not an append-only
scratchpad (Karpathy's LLM Wiki pattern):

- **Write immediately when learned:** wrong skill/category choice, failed
  premise, unexpected tool behavior, regression caught by a check, reverted
  edit, or a bottleneck that will recur across sessions.
- **Format each lesson cleanly:**
  - *What broke / surprised us* (concrete symptom + file/command)
  - *What caught it* (exact check or user correction)
  - *The rule next time* (trigger -> exact action)
- **Consolidate, don't duplicate:** update an existing topic note when one
  already covers the subsystem instead of creating overlapping fragments. Keep
  frontmatter descriptions crisp so recall surfaces the right note.
- **Provenance & safety:** never store secrets, tokens, or credentials. Record
  a user decision as `source: "user"` only with their verbatim approval quote;
  agent conclusions use `source: "agent"` or `"inferred"`.
- **Isolated bench / sandbox safeguard:** when running inside an isolated
  benchmark or evaluation fixture ("edit only inside WORKDIR"), do **not**
  mutate shared host memory; record lessons in the run's ledger and report
  instead.
