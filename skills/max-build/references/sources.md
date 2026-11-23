# Sources

## Built from (self-contained core)

- `prompt-builder` 1.2.1: Q's work prompt, copied verbatim into SKILL.md, plus
  its OmO adapter. Provenance: posted by Q (김연규, OmO's creator) in the OmO
  Korean KakaoTalk room on 2026-10-02 and 2026-10-04 as the prompt he actually
  uses ("제가 실제로 쓰는프롬프트임", "이거 최고임").
- `fdd` 0.1.3: oracle grounding, calibration, generator families, budgets,
  counts and shrinking ([oracles.md](oracles.md)).
- `anti-bs` 1.0.1: order map, evidence labels, BS patterns, warning ledger
  ([audit.md](audit.md)).
- `karpathy-prompt` 0.1.1: 80%-STE precision prose, format ladder, and
  expectation-contract checks.

## Self-contained OmO native playbooks (embedded in 2.0.0)

Distilled directly from OmO's shipped native skills on 2026-11-23 so
`max-build` covers every engineering, research, browsing, design, data, git,
and verification spot in one skill without switching skills:

- [research-browsing.md](research-browsing.md): distilled from OmO native
  `ulw-research` (team-first saturation, claim graph, observation manifest,
  code-settles-code, skeptic debate, visual synthesis, teardown),
  `ultimate-browsing` (Tier 1 insane-search, Tier 1.5 agent-reach, Tier 2a
  owned stealth omowright, Tier 2b attached user browser), and `browser`
  (attached vs owned engines, user-profile safety rules).
- [embedded-playbooks.md](embedded-playbooks.md): distilled from OmO native
  `programming`, `debugging`, `refactor`, `ast-grep`, `lsp-setup`,
  `frontend`, `visual-qa`, `visualize`, `data-scientist`, `eval-integrity`,
  `remove-ai-slops`, `review-work`, `ulw-loop`, `mass-ulw`, `hyperplan`,
  `dag-library`, `omo-relay`, `git-master`, `init-deep`, and
  `coding-agent-sessions`.
- [finished-product.md](finished-product.md): zero-toy production standard and
  5-target continuous optimization hunt.
- [omo-features.md](omo-features.md): phase-by-phase OmO Full-Power Feature
  Matrix ensuring full utilization of `eval`, LSP, monitors, isolated tasks,
  teams, workflows, threads, MCPs, visual tools, memory, and
  `ask_user_question`.
- [adversarial-qa.md](adversarial-qa.md) (2.1.0): lens-separated QA panel
  (structured devil's advocate with pre-mortem, context-free Goldfish user
  test, forest/system view, outside-the-box moves, hostile user, future
  maintainer) with blind rounds and receipt-backed rebuttal; added on the
  user's request, unbenchmarked.
- [intent.md](intent.md) & [judgment.md](judgment.md): Alive One-Team Partner
  protocol (proactive vague/unsure kickback + evidence-backed debate and
  anti-sycophancy pushback).

## Agent-Era QA, Testing, and CI (added in 1.8.0)

Distilled into [qa-testing-ci.md](qa-testing-ci.md) from *QA and Testing
Techniques for the Agent Era: Tiered Standards, a 200-Year Lineage, CI Pain
Points, and New Techniques* (2026 research report):

- **Standards anchors:** ISO/IEC/IEEE 29119 (parts 1-5), ISO/IEC TS
  42119-2:2025, NIST SSDF SP 800-218 (v1.1 final; v1.2 draft) & SP 800-218A,
  SLSA v1.2 (Build + Source tracks), EU AI Act Reg. (EU) 2026/1744 timelines.
- **Empirical pain-point studies:** Google Testing Blog flaky-test study (Micco,
  2016); Meta predictive test selection (Machalica et al., ICSE-SEIP 2019);
  Facebook mutation study (Beller et al., ICSE-SEIP 2021); *Token Reduction Is
  Not Cost Reduction* (arXiv 2607.12161, 2026); ImpossibleBench & METR
  RE-Bench; Yang et al. 2026 (37.24% unfaithful completion claims); Needham et
  al. 2025 (evaluation awareness); OpenAI SWE-bench Verified retirement (Feb
  2026); `tj-actions/changed-files` CVE-2025-30066.
- **Caveats preserved:** preprints, secondary trackers, vendor estimates, and
  model-dependent cheating rates are directional evidence; always measure on
  the target repo and stack.

## Andrej Karpathy engineering methods (added in 1.8.0)

Distilled into [karpathy.md](karpathy.md) and [history-memory.md](history-memory.md):

- **Four Coding Pitfall Defenses:** Andrej Karpathy X post (2026-01-26,
  `x.com/karpathy/status/2015883857489522876`) and Forrest Chang's MIT-licensed
  distillation (`andrej-karpathy-skills`; authored by Chang, not publicly
  endorsed by Karpathy).
- **Autoresearch loop:** primary source
  `github.com/karpathy/autoresearch/blob/master/program.md` (March 2026).
- **Generation-verification loop & autonomy slider:** Karpathy's YC AI Startup
  School talk *Software Is Changing (Again)* (2025) and X post (2026-10-02).
- **Compounding knowledge (LLM Wiki):** Karpathy's 2026 LLM Wiki pattern
  applied to OmO's persistent memory repo.

## Working methods (paraphrased, MIT-licensed sources)

Read from shallow clones on 2026-11-16; ideas are restated, not copied.

- pstack (github.com/cursor/plugins, `pstack/`): `in-your-own-words`,
  `sharpen`, `blast-radius`, `figure-it-out`, `poteto-mode`, `arena`,
  `interrogate`, and core engineering principles.
- mattpocock/skills: `grilling`, `diagnosing-bugs`, `tdd`, `codebase-design`,
  `prototype`.
- gajae-code (github.com/Yeachan-Heo/gajae-code): `deep-interview`, `ralplan`,
  `ultragoal`, `autoresearch`.
- best-skills (github.com/LinklyAI/best-skills): `data/latest/rankings/best-100.csv`
  dated 2026-11-16, used only as pointers in [domains.md](domains.md).

## Code Mode, the request model

Applies Claude Code's Code Mode concept (observed binary 2.1.325, 2026-11-16)
using OmO's native `eval` cell, `parallel(...)`, background tasks, and
`tool.monitor`; does not depend on Claude Code.

## Bench & Numbers

Historical A/B bench records for 1.1.0-1.7.0 live in [bench.md](bench.md)
(do not rewrite). The 1.8.0 and 2.0.0 additions are unbenchmarked.
