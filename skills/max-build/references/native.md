# Self-Contained Execution & Size Scaling

`max-build` v2.0.0 embeds the operational playbooks of OmO's crucial native
skills directly in its own references so it operates as **one self-contained
major skill** without needing to switch to or spawn separate skills:

- **Deep research, WAF/blocked web, real browser:** [research-browsing.md](research-browsing.md)
  (embeds `ulw-research`, `ultimate-browsing`, `browser`)
- **Code, debugging, refactoring, frontend, visual QA, anti-slop, gate review,
  evals, durable loops, DAGs, adversarial planning, git, sessions, data,
  visualization, multi-device:** [embedded-playbooks.md](embedded-playbooks.md)
- **QA/testing/CI tiers & agent integrity:** [qa-testing-ci.md](qa-testing-ci.md)
- **Finished-product bar & optimization hunt:** [finished-product.md](finished-product.md)
- **Karpathy coding & autoresearch loops:** [karpathy.md](karpathy.md)
- **Pre-flight memory, git & session anti-repeat:** [history-memory.md](history-memory.md)
- **OmO full-power feature utilization:** [omo-features.md](omo-features.md)

Read only the specific reference file your current task needs — progressive
disclosure keeps context lean while keeping every capability inside one skill.

## When to reach for a host skill script or custom domain skill

- **Host helper scripts:** when an embedded playbook needs a host-bundled
  executable (for example `omowright.mjs`, `ultimate-browsing`'s `engine/`,
  `ast_grep_helper.py`, or `report-tools.mjs`), invoke that script directly
  while keeping `max-build` in charge of the run.
- **Specialized non-core custom skills:** for narrow domain adapters the host
  installs separately (such as `opencua`, `vaultwarden`, `moffice`,
  `apple-suite`, `pptx`, `xlsx`, `pdf`, `docx`, `gpt-image-gen`,
  `ci-test-rebuild`, `pro-review`), check the session's skill list and load
  them only when the task genuinely needs that specialized adapter.
- **Children:** when spawning a delegated child under M/L orchestration, pass
  only the exact `load_skills` that child needs (e.g. `["programming"]`,
  `["frontend", "visual-qa"]`, or `["browser"]`) — never paste large skill
  bodies into a child prompt.

## Size first (orchestration scales; rigor never scales down)

Pick size in Phase 0 from facts, state it in one line, and ratchet UP the
moment facts demand it. Never downgrade mid-run.

| Size | Facts that put the task here | Orchestration |
| --- | --- | --- |
| **S** | One behavior, at most a few files, contract clear after one read wave | Work directly in batched `eval` cells. No goal unless multi-turn, no children, no workflow. Full finished-product bar, proof, anti-slop, and optimization feedback still run. |
| **M** | Several files/modules, unknowns needing parallel recon, or cross-surface QA | `create_goal`; background `explore`/`librarian` when recon is wide; parallel `quick`/`task` only when disjoint parallelism beats local batching; `omo-native-gate-reviewer` for high-risk or requested code review. |
| **L** | Dependent phases, deep saturation research, multi-session or overnight work | Durable goal + append-only ledger; `team_create` for interdependent/research lanes; `tool.workflow` for dependency DAGs; adversarial critic on one-way doors; `omo-native-gate-reviewer` before delivery. |

Q's prompt asks for goal, mass ulw, and workflows. At S and M scale down only
the orchestration overhead above, and state why in the report — never scale
down proof, finished-product quality, taste, or anti-BS auditing.

## Inside a child session

When `max-build` itself runs inside a spawned child, nested subagents may hit
the nesting limit and team tools are lead-only. Execute the embedded playbooks
and self-audit locally, and mark any unavailable lead-only gate as `UNKNOWN`
with its reason rather than claiming it ran.
