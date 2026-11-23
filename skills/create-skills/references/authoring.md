# Authoring decisions

Read this file when shaping a package or resolving conflicting source material.
These are engineering recommendations derived from the supplied report, not
measured guarantees.

## Contract and source selection

Write a compact contract before drafting:

| Field | Decision to make |
| --- | --- |
| Task family | Which recurring requests share one procedure? |
| Baseline deficit | What missing knowledge or failure is addressed? |
| Inputs | Which formats, versions, and dependencies are required? |
| Output | What artifact or state can another observer inspect? |
| Scope | Which changes and side effects are authorized? |
| Exclusions | Which similar requests belong elsewhere? |
| Verification | Which independent check can reject a wrong result? |
| Stop boundary | What missing input or permission prevents completion? |

Do not require a separate contract file for a small skill. Keep decisions in the
skill or its existing design notes unless another artifact has a consumer.

Use the source suited to the question:

- The format specification governs portable syntax.
- Current host documentation and the installed runtime govern discovery,
  invocation, permissions, and extensions.
- Repository code, configuration, and tests govern local commands and contracts.
- Controlled local evaluations support effectiveness claims for that workload.
- Papers and first-party experiments support only their reported conditions.
- Community examples and review feedback supply hypotheses and failure cases.

Record conflicts rather than silently merging incompatible versions. Distinguish
"the report says," "the primary source says," and "we observed." If a critical
claim cannot be checked, retain its uncertainty or omit the unsupported rule.

## What to extract

| Source material | Keep | Leave out of the core |
| --- | --- | --- |
| Specification | Constraint and decisive exception | Full standard and history |
| Successful task | Reusable choice and checkpoint | Incidental transcript |
| Failure | Symptom, distinguishing check, recovery boundary | Unrelated logs |
| Configuration | Actual command, schema, dependency | Repository dump |
| Expert review | Non-obvious quality criterion | Repeated stylistic advice |
| Validator | What to check and where evidence lives | Hidden fixture answers |

For a research task, preserve claim-to-source traceability and uncertainty.
For data work, preserve schema, row accounting, and overwrite rules.
For code work, preserve behavior, patch scope, relevant checks, and unrelated
edits. Do not copy the report's code-change example into every domain.

## Smallest useful package

Start with `SKILL.md`. Add `references/` for a decision-specific lookup,
`assets/` for a reusable template or input, and `scripts/` for deterministic work
only when the resource prevents a named error or repeated cost.

A good body answers these questions in order:

1. What input and result does this task require?
2. What should be inspected before acting?
3. What is the default method, and what evidence selects an exception?
4. Which artifact or state proves the action worked?
5. What changes after failure, and when must work stop?
6. What can honestly be reported?

Example routing distinction:

- Too broad: "Use for databases, backends, SQL, and application changes."
- Focused: "Review schema migration plans for compatibility and rollback risk;
  not ordinary read-only queries."

The focused version is a candidate to test, not a guaranteed classifier.

## Resources and composition

Every reference link needs a reading condition. Keep links shallow and make
paths relative to the installed skill root. A package must not require the
author's Downloads folder, home directory, or an unavailable companion file.
Keep source provenance without making the original PDF a runtime dependency.

A helper should have a defined invocation, predictable output, meaningful
nonzero failures, bounded execution, declared dependencies, and no hidden
network activity. Store bulk output separately and return decisive results,
counts, and artifact paths without dropping failures.

Before distribution, inspect included code and references, ownership, license
or redistribution limits, revision, capabilities, and expected destinations.
Never treat `allowed-tools` as a cross-host sandbox. High-impact authorization
and mandatory checks belong in the host, not only in Markdown.

When several skills compose, give each a scope and stop boundary, avoid cycles,
and cap delegation according to the host's budget. A creator, worker, and
verifier can be roles in one process; separate model sessions are not mandatory.
Keep held-out answers and release gates outside the acting skill's control.
