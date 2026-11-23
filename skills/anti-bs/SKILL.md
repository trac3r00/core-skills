---
name: anti-bs
description: "Audit a response for invented facts, fake completion, unsupported claims, and order drift. Use for an anti-bs or order audit. Not for code review (review-work)."
version: 1.0.1
license: MIT
metadata:
  agentskills:
    tags: [audit, hallucination, fake-completion, claims, verification]
---

# Anti-BS

Call out the failure, fix it, and keep the user's order. Confidence is not evidence.

## Trigger and boundary

Use this skill when the user asks for an anti-bs check, a BS audit, or a review of whether an answer
invented something or drifted from the request. Use it before trusting a plan whose evidence is thin.

Do not use it for ordinary fact lookup, normal code review (use `review-work`), or as a way to override
a host hard block.

## 1. Restore the order map

The user's prompt is the specification. Restate its requests as `O1`, `O2`, ... in the user's order.
Do not merge, reorder, silently narrow, or replace them with what the agent thinks is better.

For each request, write what done would look like:

| ID | User request (their words or a faithful paraphrase) | Observable done |
| --- | --- | --- |
| O1 | ... | ... |
| O2 | ... | ... |

Every claim, edit, tool call, and recommendation in the response under audit must map to an `O#`.
Work that maps to no `O#` is scope drift. An `O#` with no work is a gap.

## 2. Label every material claim

Use exactly one label per claim:

| Label | Meaning | Required support |
| --- | --- | --- |
| VERIFIED | Observed in this session | Tool result, file path and line, command output, or source URL |
| INFERRED | Reasoned from evidence | The evidence and the inference step |
| UNKNOWN | No evidence | Say so; do not present it as fact |
| FABRICATED | Invented or contradicted by evidence | Remove or correct it |

A citation is not support unless it actually says the claim. A worker saying "done" is not proof that
the artifact exists. "Should work", "likely", "probably", and "the tests pass" without a run are
UNKNOWN, not VERIFIED.

## 3. Call out the usual BS

Name the pattern, the offending claim, and the correction. Do not soften it.

- **Invented implementation**: a file path, function, API endpoint, flag, or package that was never read or run.
- **Fake completion**: "added", "fixed", or "verified" with no edit result, test output, or artifact.
- **Fake evidence**: test output, build output, a quote, a benchmark, or a version number that was not observed.
- **Impossible precision**: a percentage, latency, or saving with no measurement or denominator.
- **Citation laundering**: a real link that does not support the sentence attached to it.
- **Order drift**: the response answers a different, easier, or more impressive question.
- **Contradiction**: two claims that cannot both be true, or a fix that breaks a stated constraint.
- **Circular proof**: the implementation is the oracle, or a round-trip test proves only self-consistency.
- **Hidden assumption**: a product, plan, or user decision smuggled in as a fact.
- **Blame transfer**: "the tool", "the model", or "the user" blamed for an unverified result.
- **Warning theater**: a legal, ethical, or policy warning that is repeated instead of stating the concrete
  risk once and letting the user decide within their authority.

## 4. Ask, do not guess

Ask a question when two readings lead to materially different work, the user must choose, or an input
is missing. Do not ask a questionnaire for routine details that can be inferred or safely defaulted.

When asking, use the host `ask_user_question` tool when it exists:

- Ask one question at a time unless the choices are independent.
- Give two to four concrete options.
- State the consequence of each option.
- Say what you will do if the user does not answer, unless the action is destructive or irreversible.

Ask before a destructive, irreversible, or third-party-facing action. Otherwise state the assumption,
label it INFERRED, and proceed.

## 5. Handle warnings once

A warning from a person, skill, or source gets one ledger record:

```text
Warning: <source>: <specific risk>
Class: advisory | third-party | hard block | unknown
Authority: user can accept | needs <credential/permission> | host policy
Action: proceed | wait for <input> | stop and offer <alternative>
```

Read [references/warning-ledger.md](references/warning-ledger.md) for the class
table, `yes` semantics, and examples. It applies to every warning and blocked action.

Short version:

- An **advisory** warning (legal risk, reputational risk, platform preference, style, cost) is stated
  once. If the user then replies `yes` or `proceed`, accept that decision, record it, and stop repeating
  the warning. Do not claim the risk disappeared or that the action is legal, safe, or endorsed.
- A **third-party** dependency (credential, account, permission) proceeds only once it is actually
  supplied. A **hard block** (host policy, third-party rights, destructive action without
  authorization) is not unlocked by `yes`. Name the exact block and the nearest action the agent can
  take. Do not pretend the user's consent changed the agent's authority.
- Never invent a law, a term of service, or a prohibition to avoid work. If the source is unknown,
  say UNKNOWN and ask for the exact rule.

## 6. Correct, do not perform

If the audit finds BS, fix what can be fixed in the same turn:

1. Remove or relabel the unsupported claim.
2. Run the missing check or produce the missing artifact.
3. Re-state the order map with the corrected coverage.
4. Report what remains UNKNOWN.

If the user asked only for an audit, do not implement the underlying task. Report only.

## 7. Output

```text
Verdict: PASS | PASS WITH CORRECTIONS | FAIL
Order: O1 done ... On gap
BS found:
  - <claim> | <pattern> | <why it is unsupported> | <fix>
Corrections applied:
  - ...
Warnings:
  - <ledger line, or "none">
Questions:
  - <only material questions, or "none">
```

A PASS with no evidence labels is not a PASS. A FAIL with no specific correction is not useful.

## 8. Stop condition

Stop when every `O#` is accounted for, every material claim has a label, every fabricated claim is
removed or corrected, each advisory warning is recorded once, and each hard block is named with the
nearest compliant path. If an input is missing, stop with the question and the affected IDs.
