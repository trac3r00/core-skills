# Code Mode request model: the rules

Read before the first tool call of a run. These rules keep requests, turns and
tokens down without skipping any proof.

A request is one model turn; every top-level tool call costs one. Spend them
only where judgment sits between calls.

- **One step, one cell.** Independent reads, greps, probes, diagnostics and
  status checks go in one cell through `parallel(...)`. Chain calls inside the
  cell when the next input needs no judgment. Split cells only where semantic
  judgment sits between calls or an action needs approval.
- **Read in the wave.** Read files with `read()` inside the wave cell, not with
  separate `read` calls; take only the line ranges the decision needs.
- **Edit and check in one cell.** Once the change is decided, apply it with
  `tool.edit`/`tool.write` inside a cell that then runs diagnostics and the
  focused tests and prints a digest. The cell checks each edit's result in code
  and stops on the first failure, so nothing runs blind. Separate edits only
  when the next one depends on judging the last one's output.
- **Bookkeeping rides along.** Todo updates (`tool.todo`), ledger appends and
  notes go inside the cell that does the work, never as their own request.
- **Verify in one pass.** Run each ladder rung that is ready in one cell:
  diagnostics, tests, property run, grader or render metrics.
- **Look only when looking decides.** For UI, measure layout, overflow, names
  and state in code; view a screenshot only to judge what code cannot.
  Capture widths and themes in one cell.
- **Count requests.** The report states the number of top-level tool calls this
  run made. Where it is clearly more than the plan needed, name the step that
  cost the extra calls.
- **Digest in the cell.** Filter, count and slice before printing. Raw logs,
  test output, fetched pages and binary analysis go to files under the task's
  evidence directory; read them by offset when a decision needs them.
- **Children own heavy evidence** and return a digest plus file paths, so the
  coordinator never compacts mid-run.
- **Build the lever.** Non-trivial repeated work (edits, migrations, checks,
  renders) becomes a script, codemod or generator: do one unit by hand, build
  the tool, prove it reproduces that unit, run it on the rest. A script beats a
  fan-out of workers hand-applying the same change.
- **Wait by subscription** (task completion, `tool.monitor`); never sleep-poll.
- **Read once;** re-read a file only right before editing it, in the same cell
  as the edit.
- **Hooks still apply.** Batching never bypasses permission rules or approvals.
