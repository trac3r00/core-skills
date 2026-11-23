# Sources

## The prompt

Q (김연규, creator of OmO, Senpi and LazyCodex) posted the built-in prompt in
the OmO Korean community KakaoTalk room three times with identical text
(1,084 characters): 2026-10-02 10:39 and 11:05, and 2026-10-04 01:34.
These are export timestamps; the CSV does not encode a timezone.
He introduced it as the prompt he actually uses ("제가 실제로 쓰는프롬프트임",
10-02 10:40) and later called it his best ("이거 최고임", 10-04 01:34). An
earlier, shorter version (2026-09-22 05:12) already used the final-user,
ideal-state, gap, plan and QA structure. It is a predecessor, not a claim
that deleting two paragraphs reconstructs it exactly.

Related remarks from the same room that shape the skill's notes:

- 10-02 11:06, on the quick-task paragraph: "이거가개추입니다".
- 10-04 01:27: "정성을들여서쳐주셈", against relying on ulw and memory to make
  up for a vague request.
- 09-21 05:29: users who put ulw on everything and then call it slow pressed
  "the long-running button" (오래가는버튼).
- 09-27 09:56: "매슬루는 며칠도돔" (mass ulw can run for days).

## English gloss (not a replacement for the Korean)

1. Gather all information needed for decisions with ulw explore.
2. Imagine the final user of the product. That user may be code, another
   programmer, or a real customer: make clear who the result touches and imagine
   them. Imagine how they use it and will use it. Think about how to solve,
   improve and ease their problem, and list the plan for that concretely and
   logically, with reasons.
3. Define the most ideal state, where from that user's side nothing catches,
   feels strange, regresses or degrades. List it with reasons. List every
   difference between that state and now, with reasons.
4. Without compromise, set the plan to reach that state and QA scenarios that
   verify it was reached, with reasons. Implement exactly that without
   compromise, confirm the result is 1:1, 100% identical to the ideal state, and
   where it is not, plan to bring all of it there, without exception or excuse.
5. When planning, use explorian and librarian heavily to gather as much
   information as possible. When executing, split work into finer quick tasks
   instead of unspecified low so they run concurrently, and make verification
   stricter, for maximum efficiency.
6. Write this down in detail as if running $ulw-plan, check it, always update
   the todo state, and report as you go. Plan approval is granted here in full,
   so do not ask further; proceed.
7. Set a goal and go mass ulw loop; create multiple workflows if required,
   taking a workflow as just one tool.

## Status

The wording is copied verbatim. Whether it improves results has not been
measured; no benchmark or A/B run backs this skill.

## Local adapter revision, 2026-10-23

Version 1.2.0 adds maintainer-approved operational guidance, not new quotations
from Q. Its basis is the report-only comparison of these local artifacts:

- `kakaotalk-1023-01.html`, sections 4-8, in the maintainer's local
  `.omo/ulw-research/20261023-140620/` directory.
- `kakaotalk-1023-02.html`, proposed changes G1-G7, in the maintainer's local
  `.omo/ulw-research/20261023-101125/` directory.

The reports record exact-template anchors R26611, R26731 and R29060 in the
second report's locator convention. R26743 is a separately endorsed stronger
variant, not a replacement silently folded into the archived block. Do not
mix that convention with the first report's zero-based `r` indices.

The first report's section 8 motivates explicit report-only scope,
requirement-to-evidence checks and owned-resource recovery. The second report
adds skill-repair boundaries (G3), credential handling (G5) and resource
ownership (G6). These reports were reviewed for the revision; their private
deployment claims and underlying corpus checks were not independently rerun.

Later contextual routing remarks do not justify silently weakening this
skill's explicit heavy contract. Adaptive routing remains a separate proposal.
The same distinction applies to skill repair: explicit human-directed repair
does not establish approval for autonomous self-rewriting.

The revision is unbenchmarked. Structural checks and preservation of the
quotation do not prove better outcomes, successful recovery or reduced cost.
