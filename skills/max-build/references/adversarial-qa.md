# Adversarial QA Panel: many lenses, not one tossed reviewer

Read in Phase 3 (critic pass on the plan) and Phase 6 (gate) on every run.
"Spawn a reviewer, ask it to review, accept LGTM" is not QA: one reviewer
anchored on the builder's own summary repeats the builder's blind spots.
This panel attacks the result from separated, structured angles and turns
every finding into evidence or a fix.

## 1. The lenses

Each lens has a fixed posture, input, and question. A lens that cannot
produce a concrete finding says "nothing found" with what it tried.

| Lens | Posture | Input it gets | Core question |
| --- | --- | --- | --- |
| **Devil's Advocate** | Assume it is broken; burden of proof is on the builder | Artifact, diff, Ideal, C#/S# | "Where exactly does this fail, and what check proves it?" |
| **Goldfish (fresh context)** | Knows nothing: no transcript, no plan, no intent | Only what the real user gets: the artifact and its public entry (README, `--help`, SKILL.md, UI) | "Can I use this cold to do the user's job, and where did I stumble or guess?" |
| **Forest (system view)** | Zoom out from the changed lines | Diff plus neighbors: callers, docs, CI, catalog, sibling features | "What did this do to the whole: consistency, duplicated concepts, second-order effects, the end goal?" |
| **Outside-the-box** | Question the approach, not the code | Task, Ideal, chosen design | "Is there a radically simpler or different solution, and would deleting this be better?" |
| **Hostile user / red team** | Misuse it on purpose | Real surface | "What do bad, empty, huge, concurrent, malicious, or non-English inputs do?" |
| **Future maintainer** | Six months later, alone | Diff and repo only | "Can I understand, change, and safely remove this?" |

### Devil's Advocate protocol

1. **Steelman first:** state in two lines why the builder thinks it works.
2. **Pre-mortem:** "It shipped and failed a month later. Write the three most
   likely causes." Each cause names a file, input, or condition.
3. **Falsify:** for each cause, write a runnable check (command, input,
   mutant, screenshot) that would fail if the cause is real, then run it.
4. **Attack the premises:** list the assumptions the design rests on
   (data shape, caller behavior, environment, user intent) and test the
   riskiest one directly.
5. **Verdict per claim:** REFUTED (with receipt), SURVIVED (check ran and
   passed), or UNTESTED (why). "Looks fine" is not a verdict.

### Goldfish protocol

The value is the missing context, so protect it:

- Spawn with no session history: a fresh `agent(...)` or `task` (`explore`
  for read-only artifacts, `quick` when it must run things) whose prompt holds
  only the artifact paths and the end user's job in user words. Never paste
  the plan, the builder's summary, the intended answer, or "this should work".
- Ask it to do the job, not to review: "Using only these files, do X. Record
  every point where you hesitated, guessed, or needed information you did not
  have." For docs/skills/prompts: "Follow these instructions to do X" and
  diff what it did against what was meant.
- Score: succeeded or not, wrong assumptions made, questions it had,
  steps it skipped. Each stumble is a curse-of-knowledge gap: fix the
  artifact (name, message, doc, default), not the Goldfish's prompt.
- Rerun a fresh Goldfish after fixes; never reuse the one that already learned.

### Forest checklist

- Does the change fit the codebase's existing concepts, or add a parallel one?
- What else references the touched names, numbers, behavior? Still true?
- What got worse elsewhere: speed, token cost, docs accuracy, mental model,
  operator steps, rollback path?
- Does the result move the end goal from Phase 0, or only the surface ask?
- Which earlier failure (memory, reverts) could this reintroduce?

### Outside-the-box moves

- **Inversion:** how would we guarantee this fails? Check none of that is true.
- **Subtraction:** what if this code, flag, or step did not exist?
- **10x simpler:** sketch the smallest design that meets Ideal; if it beats
  the built one, say so with evidence.
- **Other personas:** novice, power user, screen reader, slow network,
  different OS/locale, another agent consuming the output.
- **Extremes:** 0, 1, many, huge, concurrent, interrupted, upgraded, rolled back.

## 2. Run order and independence

1. **Round 1, blind and parallel:** lenses run without seeing each other's
   findings or the builder's self-assessment. Independence is the point.
2. **Merge:** dedupe into one findings table (format below). Drop findings
   with no evidence or repro; they are opinions.
3. **Round 2, rebuttal:** the builder answers each finding with a receipt
   (check run, line cited) or fixes it. Prose rebuttals do not close findings.
4. **Converge:** stop when a round adds no new HIGH/MED finding, or the stated
   budget is spent; leftovers go to Open with their severity.

```text
F1 [lens] [HIGH|MED|LOW] [confidence high|med|low]
Claim: <what is wrong, one sentence>
Evidence: <file:line, command + output, screenshot, Goldfish transcript line>
Repro/check: <runnable step that fails now>
Resolution: FIXED (<receipt>) | REFUTED (<receipt>) | OPEN (<why>)
```

## 3. Scale by size (rigor never drops)

- **S:** run every lens yourself as a written pass in one cell, but run the
  Devil's Advocate checks for real; Goldfish via one cheap fresh `explore`
  when the deliverable is read by people or agents (docs, skills, CLI, API).
- **M:** Goldfish and Devil's Advocate as parallel background children,
  other lenses local; then ONE `omo-native-gate-reviewer` on the merged result.
- **L / one-way doors:** full panel as a team (one member per lens), two
  rounds, plus the gate reviewer. Use `hyperplan` style cross-critique for the
  plan itself.

A child costs far more than a local pass ([delegation.md](delegation.md)):
delegate a lens only when its independence (Goldfish) or breadth needs it.

## 4. Anti-patterns

- Tossing "please review" with the builder's summary attached (anchoring).
- Accepting LGTM, a score, or a finding list with no receipts.
- A Goldfish that was told the intent, or reused after it learned.
- Nitpick floods that hide the one HIGH finding; rank by severity.
- Lenses that only read code when the real surface can be run.
- Changing tests or Ideal to make a finding go away (sealed oracles,
  [qa-testing-ci.md](qa-testing-ci.md)).
