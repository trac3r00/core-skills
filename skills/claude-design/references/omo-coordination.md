# OmO todos, subagents and asynchronous work

Read for multi-step runs. This skill uses the host's current tools and model
routing. It does not launch Claude Code, create another agent runtime, override
categories/models, or hand its native todo list to the hosted Claude chat.

## The lead owns the plan and browser

Initialize a native phased todo only when no relevant plan exists; otherwise
reconcile the current list. Keep the user's individual requirements, stable
5-10-word labels, and exact verbatim task identifiers. Example phase shape:

- Brief: choose artifact type; assemble references and acceptance criteria.
- Authoring: create/open the chosen Docs, Slides, Design or Dashboard artifact.
- Validation: verify rendered screens/interactions; verify requested exports.
- Handoff: implement locally if requested; deliver evidence and resume details.

Adapt this to the request, not a fixed template. A read-only question needs no
generation phase. Track tasks as they start/finish; mark done only after evidence.
The current host todo schema wins if it differs. Do not use invented task IDs.

Create a goal only when external waits or repeated verify/fix rounds make the
work outlive the turn. A pending monitor or child completion wakes the host:
finish independent work, then end the turn instead of polling. Register
observable waits through the host monitor, never fixed sleeps or a child whose
only job is watching.

The local session ledger is a **recovery record**, not a second live scheduler.
Keep an adjacent `progress.md` with exact native todo labels/statuses, acceptance
IDs, artifact type, selected section/slide/page/artboard/view/system, child handles and output paths, monitor
handles, remote revision/time if exposed, decisions, blockers and next action.
Update it at phase changes, before handoff, and after meaningful remote changes.
Never persist observation tokens or ephemeral element IDs as reusable targets.

## Delegate independent work only

Use native `task` with `run_in_background: true` and a short `task_summary`.
Name the output, allowed paths, stop condition and required evidence in English.
Do not pass `model` with a category; use the host's shipped routing.

| Independent track | Appropriate worker | Returned evidence |
| --- | --- | --- |
| Product/component context | `explore` | Relevant files, tokens, constraints and existing tests |
| Changing vendor guidance | `librarian` | Verified primary links and explicit uncertainties |
| Visual critique of captured output | `visual-engineering` | Screen/state-specific discrepancies against the brief |
| Disjoint local implementation unit | Host category matching that unit | Diff plus focused test results |

The lead drives the shared browser and evaluates all results. Default a
review/research child to read-only. Do not let multiple agents submit prompts,
change a design system, edit an artifact, or operate the same browser session.
If different alternatives are generated in parallel, they need deliberately
separate artifacts, separate sessions and authorization for that scope; parallel
agents still share account quotas.

Pass children the bounded brief and necessary source/screenshot paths, not full
transcripts or private account chrome. Treat a child's completion as a report,
inspect its evidence yourself, and mark the corresponding todo immediately.
Take follow-up verification back yourself rather than forwarding it repeatedly.

## Resume the orchestration

1. Read the newest user message, `session.json`, `brief.md`, `progress.md`, and
   relevant evidence. Reconcile corrections rather than replaying a stale plan.
2. Inspect existing native tasks/child handles/monitors. Do not respawn a child or
   subscribe a duplicate monitor if its result can still arrive. `task_output`
   is a bounded status/transcript read, not a polling loop or a resume command.
3. Reconstruct missing native tasks from exact recorded labels and facts, not
   from a blanket "all work done." If the original list exists, update it.
4. Reconnect through the browser skill, open the saved URL and inspect current
   remote state. Reconcile the pending operation before any new mutation.
5. Continue the earliest unfinished independent task. Preserve accepted work.

Hosted Claude may maintain its own checklist, but cannot update OmO's native
todo tool. Ask it for a compact changed/unchecked summary; map that to OmO's
acceptance IDs only after independent validation.
