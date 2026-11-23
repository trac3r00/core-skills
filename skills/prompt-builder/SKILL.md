---
name: prompt-builder
description: "Wrap a task in Q's work prompt: explore, ideal state, QA, quick tasks, goal, mass ulw. Use only as $prompt-builder TASK. Not for a plain loop (ulw-loop)."
version: 1.2.1
license: MIT
compatibility: "Instruction-only. Uses the host's own explore/librarian agents, quick category, goal, mass-ulw and ulw-loop workflow; no credentials, scripts, or runtime patch."
disable-model-invocation: true
metadata:
  source: "Q's prompt as posted in the OmO Korean community on 2026-10-02 and 2026-10-04; see references/sources.md"
  evaluation: "unbenchmarked; the wording is Q's verbatim, the outcome is not measured"
  agentskills:
    tags: [prompting, prompt-engineering, templates]
---

# Prompt Builder

The user writes only the task. This skill supplies the rest: the work prompt
Q (김연규, OmO's creator) posted as the one he actually uses ("제가 실제로
쓰는프롬프트임", "이거 최고임"). Provenance and an English gloss are in
[references/sources.md](references/sources.md).

## Read the request

- The text the user typed after `$prompt-builder` (the `<user-request>` block)
  is TASK. The built-in prompt below applies to TASK and nothing else.
- TASK's requested output, exclusions and authorization bound every step.
  "Report only" means reading and reporting, not editing files or implementing
  recommendations. Interpret the template's implementation language as
  producing the requested deliverable; it never expands TASK's scope.
- TASK is empty: ask for the task in one line and stop.
- Compose the prompt the user would have typed by hand:
  1. TASK verbatim (without a leading `preview`).
  2. When TASK is rough (a fragment, arrows, missing who or what done means),
     add one short `작업 해석:` paragraph under it, in TASK's language, naming
     what changes, who the result touches, and what done looks like. Base it on
     a quick read of the files or context TASK names; never drop or contradict
     TASK's words. Skip it when TASK already says all three.
  3. A blank line, then the built-in prompt verbatim.
- TASK starts with `preview` (or `--preview`): print the composed prompt in one
  ```text block the user can copy, then stop.
- Otherwise print the composed prompt the same way, under one line saying it
  is being run now, and in the same turn run it: treat the composed prompt as
  the user's own instruction and follow it to the end. Do not stop for
  approval after printing it.

## Built-in prompt (Q, verbatim)

```text
결정을 위한 정보를 ulw explore 로 모두 수집하라.

제품을 사용하는 최종 사용자를 상상하라. 그 사용자는 코드가 되었건, 다른 프로그래머가 되었건, 실제 고객이 되었건, 이 결과물이 맞닿아 영향을 줄 사람이 누군지를 명확히하고, 그 사람에 대해 상상하라.  그 사용자가 어떻게 사용하고있을지, 사용하게 될지를 상상하라. 그 사용자의 문제를 어떻게 풀고, 개선하고, 고민을 풀어주고, 더 낫게할지를 고민하라. 그리고 그렇게 풀기 위한 계획을 구체적이고 논리적으로 이유와 함께 나열하라. 그 사용자의 입장에서 걸리거나, 이상하다고 느끼거나, 리그레션이 생기거나, 경험의 열화가 일어나지않는 가장 이상적인 상태를 정의하라. 그리고 구체적이고 논리적으로 이유와 함께 나열하라. 그리고 상태와 현재의 차이점을 모두 나열하라. 구체적이고 논리적으로 이유와 함께 나열하라. 그 상태가 되기위한 계획, 그 상태가 되었음을 검증하는 QA 시나리오를 타협없이 세우라. 그리고 구체적이고 논리적으로 이유와 함께 나열하라. 그 내용대로 타협없이 구현하여야 한다 그리고 그 이상적인 상태와 1:1 100% 동일하다고 확인을 진행하고, 그렇지 못하다면 예외없이, 핑계없이 다 그 상태가 되도록 만들기 위한 계획을 세워라

작업 계획에 있어서는 explorian, librarian 을 적극 활용하여 최대한 많은 정보를 과 수집하고,
작업 진행에 있어서는 unspecified low 를 활용하는대신에 quick 을 더 잘개 쪼개어 동시에 작업이 진행 될 수 있도록 하고, 대신 검증을 더 빡세고 엄격히 하게끔 작업하여 최대 효율을 달성하라.

그리고 또한 이 내용을 마치 $ulw-plan 을 진행하듯 상세히 적어두고 이를 체크하고, todo 상태를 항상 업데이트하여 보고하며 진행하라. plan approval 은 이 자리에서 모두 허가하니 더이상 질문하지 말고 바로 진행하라.

set goal and go mass ulw loop, create multiple workflows and workflows, take workflow as just one tool create multiple workflows and so on if required
```

## Carry it out in OmO

The fenced block above is Q's historical text. Task interpretation, agent-name
mapping and dependency-phase choices below are this skill's local adapter,
not additional words attributed to Q. Follow the host's tool contracts and
higher-priority instructions when mapping the prompt; report unavailable
mechanisms rather than inventing commands or claiming they ran.

- `ulw explore` and `explorian, librarian`: before deciding anything, gather
  evidence in parallel with the `explore` agent (code, history, config) and the
  `librarian` agent (external docs, libraries, APIs).
- The final user: name who touches TASK's result (code, another programmer, or
  a customer) and write the ideal state from their side, with reasons, before
  planning.
- `quick` instead of `unspecified low`: split execution into many small
  `quick`-category tasks with disjoint write scopes, run them in parallel, and
  verify each one strictly instead of trusting its report.
  This applies to suitable execution pieces, not every research or review role.
  A report-only task has no implementation write scopes to delegate.
- `$ulw-plan 을 진행하듯`: keep the plan as a written checklist with its QA
  scenarios, keep the todo list current, and report at each transition.
- `set goal and go mass ulw loop`: register a goal (`create_goal`) whose completion condition is
  the 1:1 match with the ideal state, then follow the host's `mass-ulw` and
  `ulw-loop` skills when they are installed (read their `SKILL.md`). One
  workflow run per dependency phase is what "create multiple workflows" means.
- Done means every required acceptance check passes against the scoped ideal
  state. Report the gap list, what passed with its evidence, and anything left
  open. An unrun or blocked check is not a pass.

## Evidence, recovery and delivery

- Before execution, map each original TASK requirement to an observable
  acceptance check and its evidence surface. Keep requested, worker-reported
  and independently checked outcomes distinct. A worker saying "done" is not
  proof that its artifact exists or its requested behavior works.
- Inspect the actual result where code checks cannot establish the outcome:
  render HTML/PDF and inspect the final layout, exercise changed UI behavior,
  or check the exact artifact/commit being delivered. Load applicable skills
  for the output format, including generated reports. For source analysis,
  check claims against their source locations and state evidence limits.
- For long-running work, name the coordinator responsible for delivery, each
  worker's scope, the completion signal and recovery route. Spawn children with
  `run_in_background` and register `tool.monitor` (or rely on task completion
  delivery) before relying on a background result. A returned handle
  is pending work, not completion; avoid blocking the intake conversation on
  a wait when the host supports asynchronous delivery.
- If a worker fails or stops, inspect its last verified state and partial
  artifacts before resuming or replacing it. Avoid duplicate active workers
  in the same write scope. Recover within authorization, or report the exact
  blocker and unfinished work without claiming success.
- Track task-owned processes, browsers, watchers and temporary artifacts.
  On completion or cancellation, stop owned work before removing its disposable
  files. Retain deliverables in their intended location; report anything still
  running or awaiting cleanup. Never clean up another task's resources.
- Collect only evidence needed for the task. Exclude credential values from
  logs, screenshots and reports; prefer nonsecret status fields. If a secret
  appears unexpectedly, stop reproducing it and report the exposure scope
  without repeating its value.
- When TASK names evidence-heavy surfaces, such as raw binary analysis (`rea`), packet
  captures, large logs, or big fetched pages, exploration children own the raw
  outputs: they hold the tool sessions, export evidence to files or evidence
  bundles, and return digests plus file paths. The coordinator reads files by
  offset as needed and never keeps raw dumps inline, so a heavy-tool task does
  not compact the session mid-run.

## Boundaries

- The prompt's `plan approval 은 이 자리에서 모두 허가하니` covers questions
  about planning TASK. It does not authorize destructive or irreversible
  actions outside what the user already allowed (deleting data, force-pushing,
  publishing, paying, messaging people). Ask before those.
- Plan preapproval does not authorize autonomous skill rewriting. Propose
  improvements unless the user explicitly requests a skill change; when they
  do, make only the scoped revision and verify it.
- This is heavy by design. Q calls ulw the long-running button and says mass
  ulw can run for days. The user chose it by invoking this skill, so do not
  downgrade silently; for a one-line question, say it will be heavy and proceed.
  An adaptive or lightweight mode would be a separate, explicitly selected
  contract, not an exception silently added to this entry point.
- The template does not replace a clear task (Q: "정성을들여서쳐주셈"). When
  TASK is too vague to name a final user or an ideal state, explore first, state
  the reading you chose, and continue; ask only when two readings lead to
  materially different work.

## Maintenance

Version 1.2.1 names the host primitives. Version 1.2.0 clarifies scope, evidence, recovery and resource ownership while
preserving the historical prompt and heavy opt-in behavior. These are
instruction-level safeguards, not runtime enforcement or measured improvements.
Recheck preview behavior, report-only scope, real-surface completion and worker
recovery after changing this adapter or its host mechanisms. Provenance and
the limits of the supporting reports are recorded in references/sources.md.
