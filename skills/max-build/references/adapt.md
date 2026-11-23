# Adapting when a step is blocked

A failed command, a missing tool, a denied call or a surprising result is
information, not a stop sign. Read the error, classify it, and take the next
route in the same turn.

## Classify, then route

| What happened | First move | Next routes, in order |
| --- | --- | --- |
| Command failed (non-zero exit, stack trace) | Read the whole error; fix the input it names | Check the tool's `--help` or docs for the right flag; run the narrower command that isolates the failing part |
| Tool, skill or CLI not found | Check for a rename or successor (README, launcher script, MCP entry, package changelog) | The host feature that does the same job ([omo-features.md](omo-features.md)); a scriptable surface; build a small lever; report the gap |
| Network or source unavailable | Try another source for the same fact (`context7`, `webfetch` of the docs page, `librarian`, a local copy, the package source in `node_modules`) | Archive or mirror via `ultimate-browsing`; state which facts stay UNKNOWN |
| Permission denied by a rule, a hook, or the user | Stop that action: it is final | Do the rest of the task; state exactly what was not done and why, or ask the user if only they can change it. Never reach the same result through another tool, path or host. |
| Missing credential, account or approval | Do every part that does not need it | Prepare the exact command and expected output; ask once |
| Test or check fails unexpectedly | Decide: harness defect, unspecified behavior, or real bug (read the failing detail) | Fix the right side; never weaken the oracle |
| Two fixes on one premise failed | Write the premise down and test it directly | Attack the premise ([judgment.md](judgment.md)) |
| Child failed or went silent | Read its last verified state and partial artifacts | Send one targeted follow-up; else replace it with a smaller brief or do the unit locally |
| Context or budget pressure | Move bulk output to files and children; keep digests | Narrow the scope of reads; never drop a requirement silently |
| The request itself conflicts with evidence | Show the evidence | Offer the closest version that meets the user's goal |

## Habits

- Change something material on every retry: input, tool, source, or
  assumption. An identical retry is not a new attempt.
- Keep momentum: while one route waits (a question, a child, a monitor), work
  on everything that does not depend on it.
- Prefer the route with the most evidence and the least irreversibility.
- Every surprise that cost a retry goes into memory with the route that worked
  (see the Learn step in SKILL.md), so the next run starts on that route.
- "Blocked" means only the user can unblock it and they were asked; anything
  else is a route not yet tried.
