# Source and evidence boundaries

This package synthesizes the user-supplied **Agent Skills in the Agentic World:
Architecture, evidence, reliability, and token-efficient design**, dated
27 September 2026, from `Agent_Skills_Research_Report.pdf` (20 pages).

Source SHA-256:
`85d13c25c4bfa59047ab12bfe58a89040e658fcabbaf7bef03adb1b2ebb3f6be`

All 20 pages were extracted and read when authoring this package. The PDF's
metadata attributes the report to "Research report prepared with ChatGPT."
Its stated status is a critical narrative review and proposed engineering
methodology, not a reproduced benchmark or security certification. We have not
independently rechecked its external references or reproduced its experiments.
The PDF is provenance, not an installed runtime dependency.

## Traceability

| Package decision | Report location |
| --- | --- |
| Distinguish skill, prompt, tool, memory, and enforcement | Sections 3.1-3.2, pages 4-5 |
| Portable fields and progressive disclosure | Sections 4.1-4.2, page 5 |
| Authority, resume state, and host differences | Sections 4.3-4.4, page 6 |
| Task contract and evidence packet | Sections 5.1-5.3, pages 6-7 |
| Focused description and small decision structure | Sections 6.1-6.2, pages 7-8 |
| Justified resources and composition boundaries | Sections 6.3-6.4, page 8 |
| Baseline and limits of effectiveness evidence | Section 7, page 9 |
| Independent verification and evaluation arms | Section 8, pages 10-11 |
| Cost accounting and token efficiency | Section 9, pages 11-13 |
| Package inspection and external enforcement | Section 10, pages 13-14 |
| Versioning, promotion, rollback, and retirement | Sections 11-12, pages 14-15 |
| Claim qualifications and research limitations | Sections 13-14, pages 15-16 |
| Example contract, evaluation cases, readiness | Appendices A-C, pages 17-18 |
| Original source identities and qualifications | References, pages 19-20 |

## What was deliberately not converted into rules

- The `verified-code-change` starter is illustrative and unbenchmarked. It is
  not a second installed skill and is not a substitute for domain expertise.
- SkillsBench results apply to the cited version, metric, tasks, models, and
  harnesses. Aggregate pass rate and fully solved rate are different measures.
- The reported Vercel result is a scoped Next.js experiment, not proof that
  persistent instructions always outperform skills.
- Repository-context studies are adjacent evidence, not direct tests of every
  skill package.
- Hypothetical token examples are arithmetic, not promised savings.
- Vendor recommendations, community enthusiasm, and popularity are not
  independent effectiveness evidence.
- The 500-line/about-5,000-token guidance is not an optimal target; the
  1,024-character constraint applies to the description, not all frontmatter.
- Host-specific paths and permissions are a dated snapshot. Test the actual
  runtime rather than assuming another host's behavior.

## Sources to recheck when contracts change

The report points to the Agent Skills *Specification* and *How to add skills
support to your agent* for portable structure and loading (references 4-5);
Claude Code *Extend Claude with skills*, OpenAI *Build skills*, and OpenClaw
*Skills* for host behavior (6-8); official authoring guidance (10-11);
OpenAI *Testing Agent Skills Systematically with Evals* and Anthropic
*Demystifying evals for AI agents* for evaluation design (15-16); and provider
prompt-caching and reasoning documentation for accounting (19-21).

Retrieve the applicable current primary source when depending on its mutable
API or host behavior. Keep this package's recommendations labelled as synthesis
until a local evaluation supports a stronger claim.
