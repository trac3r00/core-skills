# OmO Full-Power Feature Matrix (Start to Finish)

Read in Phase 0 and check at every phase boundary. OmO ships far more than
plain file edits and shell commands. **Never settle for weak manual loops,
blind grep, or raw bash hacks when OmO has a superior native capability.**
Check the session's active tool list; when a tool is absent on the current
host, note it once and take the fallback.

## 1. Phase-by-Phase Full-Power Utilization Check

| Phase | Mandatory OmO power tools to reach for | Never downgrade to |
| --- | --- | --- |
| **Phase 0-1 (Frame, History, Debate)** | Recalled `memory` + `coding-agent-sessions` + `git log`; `ask_user_question` for vague/uncertain forks or strategic debates; `create_goal` + `todo` for M/L durable state | Guessing silently, skipping history, keeping plans only in prose |
| **Phase 2 (Discovery & Research)** | One batched JS `eval` with `parallel([...thunks])`; `lsp_symbols` / `lsp_find_references` / `lsp_goto_definition`; `ast-grep` for syntax shapes; `context7` MCP for library docs; `web_search` / `webfetch`; `research-browsing.md` tiers for blocked/authenticated web; `team_create` + `explore`/`librarian` for deep saturation | Serial one-by-one reads, regex guessing over symbols, giving up on 403/JS pages |
| **Phase 3-4 (Build & Orchestrate)** | `eval` batched edits + verification; `lsp_prepare_rename` / `lsp_rename` for safe renames; `apply_patch` for multi-file atomic patches; `task` (`run_in_background: true`, `isolated: true` for risky parallel edits); `team_create` for interdependent lanes; `tool.workflow` + `dag-library` for real dependency graphs; `tool.monitor` for long builds/watches | Unnecessary child spawns for tiny edits, overlapping writes, `sleep` polling |
| **Phase 5 (Prove & Inspect)** | `lsp_diagnostics` on every changed file; `Bun.WebView` / `omowright` for real UI layout & screenshots; `opencua` MCP for Mac/iPhone GUI; `py` kernel (DuckDB/Polars/NumPy) for data; `rea` MCP for binaries/Electron; `look_at` / `read_video` / `media_ocr` for visual/media QA; `tool.monitor` for async gates | Claiming UI works from CSS source, dumping raw logs into context, timing-luck sleeps |
| **Phase 6 (Gate, Deliver & Compound)** | `omo-native-gate-reviewer` for M/L review gates; `show_html_page` when a visual report/chart/diagram beats chat prose; `memory` tool immediately for lessons/pitfalls; `team_delete` + resource cleanup; `update_goal` | Ending with raw file paths when visual report fits, leaving live teams/temp dirs, forgetting lessons |

## 2. Inside an `eval` Cell (JS & PY Kernels)

| Need | Feature | Notes |
| --- | --- | --- |
| Independent reads, greps, probes | `parallel([...thunks])` with `tool.read`, `tool.grep`, `tool.bash` | One request instead of many; keep every failed item visible verbatim |
| Staged batch over many items | `pipeline(items, stageA, stageB)` | Barrier between stages: find -> edit -> verify |
| Cheap classification, extraction or ranking | `completion(prompt, { model: "smol", schema })` | Stateless call, zero child session overhead |
| Child whose output feeds later code | `agent(prompt, { handle: true })` | Pass handles, never raw transcripts |
| Many uniform child jobs | `workpool(...)` | Host-owned scheduling for structured fan-out |
| Headless web render, measure, screenshot | `new Bun.WebView({ width, height })` | Measure boxes/overflow/state in code; screenshots for visual judgment |
| Data processing & statistics | `py` kernel (DuckDB, Polars, NumPy) | Keep data resident in kernel; print only verified aggregates |
| Shell commands inside a cell | `Bun.$` / `tool.bash` (never `Bun.spawnSync`) | Long jobs go through `tool.monitor`; never shadow/delete platform globals like `globalThis.crypto` |

## 3. Waiting, Concurrency & Durable State

| Need | Feature |
| --- | --- |
| Wait for build, test, CI, deploy, file, or log pattern | `tool.monitor({ command \| path, filter })`; never sleep-poll |
| Background process outliving a call | `tool.bash({ command, run_in_background: true })`, `bash_output` only to steer, `kill_bash` to stop |
| Watch child sessions / peer RPC state | `tool.monitor({ type: "rpc", target: "children" \| "all" })` or auto completion notifications |
| Resume later at a known time | `schedule_wakeup` / `schedule_prompt` |
| Durable objective across compactions | `create_goal`, `update_goal`, `get_goal` |

## 4. Code Intelligence, Delegation & Cross-Session

| Need | Feature |
| --- | --- |
| Symbol graph & safe refactor | `lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_prepare_rename`, `lsp_rename` |
| Syntax-shape search or codemod | `ast-grep` (`sg` / `ast_grep` MCP) |
| Atomic multi-file patch | `apply_patch` |
| Independent parallel units | `task` batch (`run_in_background: true`, category per [delegation.md](delegation.md)) |
| Risky parallel edits | `task` with `isolated: true` + `merge: "patch" \| "branch"` |
| Interdependent cooperating lanes | `team_create`, `task_send`, `task_create`/`task_list`/`task_update`, `team_delete` |
| Dependency-ordered DAGs | `tool.workflow` + `dag-library` |
| Peer sessions & multi-device fleet | `tool.thread_list` / `thread_send` / `thread_read`; fleet SDK `bunshin` |

## 5. External Knowledge, Visual, Desktop & Learning

| Need | Feature |
| --- | --- |
| Library or framework docs | `context7` MCP (`resolve-library-id` -> `query-docs`), else `librarian` |
| Web, WAF-blocked hosts, signed-in sites | [research-browsing.md](research-browsing.md) (Tier 0 -> 1 -> 1.5 -> 2a -> 2b) |
| Binaries, Electron apps, native bundles | `rea` MCP; isolate bulky output to files/children |
| Infrastructure / VMs / private CI host | `proxmox` MCP (search/describe endpoints first; check UPID status/log) |
| macOS / iPhone GUI automation | `opencua` MCP (formerly apple-cua — standing user choice; check renames before calling any tool missing) |
| Visual / media inspection & creation | `look_at`, `read_video`, `media_ocr`, `generate_image`, `show_html_page` |
| Compounding memory & user alignment | `memory` tool immediately on lessons; `ask_user_question` for true forks/debates; `todo` riding inside working cells |
