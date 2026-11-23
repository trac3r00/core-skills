---
name: karpathy-prompt
description: "Write output a reader can verify without guessing: 80%-STE prose, format ladder. Use when writing reports or summaries. Not for skill authoring (create-skills)."
version: 0.1.1
license: MIT
metadata:
  agentskills:
    tags: [writing, prompting, reports, clarity]
---

# Karpathy Prompt

One thesis: models generate faster than humans can understand, so the craft is
output a reader can verify against their expectations without guessing
(Karpathy, X 2026-10-02). Three rungs of craft follow: precision prose, the
format ladder, and, when the artifact is itself a prompt, explicit success
criteria.

## 0. Expectation contract (always, before writing)

Fix four things first:

- (a) who reads this;
- (b) what they must know, decide, or do after reading;
- (c) the format they expect;
- (d) what would count as wrong.

If one is unknown and would change the output materially, ask once. Otherwise
pick the sensible default and state it in one line. Before delivering, verify
the output against (a)-(d) and report any unmet item. Never claim done with an
unmet expectation unstated.

## 1. Precision prose (default rung)

Write at "80% of the way to ASD-STE100", Simplified Technical English
principles, not the full standard. Evidence: the full standard made a model
drop 46.8% of facts in code explanations; 80% kept all facts and still cut
sentence length 35-40%.

Rules (English or Korean, ASD-STE100 is English-only; port the principles):

1. Conclusion, decision, or request first; reasons after.
2. Name the actor. Active voice; instructions imperative. No passive in procedures.
3. One idea per sentence. No semicolons, split. Keep procedure sentences
   short (STE caps: 20 words procedural, 25 descriptive; for Korean, one clause per idea).
4. One meaning per term. Same object, same word. Max 3-word noun clusters; split longer ones.
5. Verbs stay verbs: "검토를 진행한다" → "검토한다"; "perform an analysis of" → "analyze".
   No soft phrasal verbs: "spin up" → "start", "reach out" → "contact".
6. Plain over fancy: use, about, before, get, start, change, stop, make sure,
   not utilize, approximately, prior to, obtain, commence, modify, terminate, ensure.
7. Ban AI buzzwords: delve, leverage (verb), seamless, holistic, game-changer, tapestry, blazing-fast.
8. Keep domain terms, product names, and code identifiers exactly as they are.
   Never simplify them away, that is where the fact loss happens.

Guards:

- Preserve hedges: may, could, might, "측정되지 않았다" stay uncertain. Never upgrade probability to certainty.
- Preserve facts: concretizing must not invent a subject, cause, number, or deadline. Unknown stays unknown.
- No chatty preamble or self-referential summary. Deliver the result, unpadded.

Calibration:

- Use for: explanations, summaries, reference sections, settings, error
  messages, instructions, bug analyses, text a reader scans to act on.
- Keep out of: introductions, narratives, anything meant to sound like a
  person. STE cuts the connections that make them work.
- Expect sentence length to drop ~35-40%, not total length. If the problem is
  length, cut content instead.

## 2. Format ladder (escalate with cause, never decoration)

Escalate one rung only when prose demonstrably cannot carry the content:

1. Text, default (section 1).
2. Diagram, topologies, state machines, protocols, data flow. Mermaid or SVG
   with labeled actors and arrows; add an invariants list under it. Defer
   rendering to the visualize skill where installed.
3. Interactive page, the reader must step through, manipulate, or explore
   state. Single-file HTML, zero build, step controls, reactive state view.
   Defer to frontend/visualize.
4. Explainer video, deep math, algorithm, or concept demos. Rarely justified:
   confirm with the user before producing.

Multi-format: write one 5-7 point outline first and build every format from
it, so they tell the same story.

## 3. Prompt and instruction rung (when the artifact is a prompt or instruction)

"Don't tell it what to do, give it success criteria and watch it go" (Karpathy).

- State goal, rules, and style as separate labeled sections; use explicit
  separators (headers or XML-style tags) so a model can parse the parts.
- Every rule = one testable behavior. Concrete do / do-not pairs over
  adjectives. Examples beat descriptions.
- End with success criteria the model can loop against: observable checks,
  not "make it good".
- Progressive disclosure: keep the core under ~500 lines / 5,000 tokens; push
  branch detail to referenced files, and say when to read each.

## 4. Completion check (all three, every time)

- Reader test: can the reader answer "what does this mean, who does what,
  what must I do" without re-reading?
- Fact test: did any fact get added, upgraded, or simplified away that the
  source did not state? Are domain terms intact?
- Contract test: does the output satisfy the expectation contract from
  section 0? Report any gap.

## Boundary

Not for: execution-prompt orchestration (prompt-builder), skill authoring
(create-skills), audience simplification for a named reader (eli5), page or
diagram rendering (visualize, frontend), or publication drafts in a personal
voice, those keep natural, varied sentences. When a request lands in another
skill's lane, route there and stop.

Status: unbenchmarked as installed (dry run 2026-10-26; bench evidence is from
the cited public tests, not from this skill's own runs).

Provenance: Karpathy X 2105819303471976479 (ladder, STE tip); Karpathy X
2015883857489522876 via forrestchang/andrej-karpathy-skills (success-criteria
principle); ASD-STE100 Issue 9 rule inventory via samirsawarkar/asd-ste100-skill;
80% placement and fact-loss evidence via stashbase.ai; GPTers 9-rule Korean
distillation.
