# Evaluation and efficiency

Read this file before claiming that a skill improves routing, task success,
cost, or reliability. The protocol is a proposed method, not a benchmark result.

## Separate the failure stages

Track installed, discovered, eligible, advertised, selected, loaded, resources
retrieved, executed, independently checked, and reported. Capture the loaded
revision and resolved base directory. Invocation alone proves none of the
later stages.

Check explicit activation first. Then test automatic activation in fresh
sessions with positives, near misses, and ambiguous requests. A missed selection
and a failed execution after selection require different fixes.

## Start small; compare only what the claim needs

Use representative development cases to find defects. Define held-out cases
before tuning and keep their answers and graders out of the skill package.
Three initial examples can reveal a defect, not establish deployment reliability.

| Arm | Intervention | Question |
| --- | --- | --- |
| A | Native agent, no new skill | What already works? |
| B | Minimal persistent facts or documentation index | Is retrieval enough? |
| C | Core skill, automatic activation | Does routing plus execution help? |
| D | Same core, explicit activation | Was selection the failure? |
| E | Core plus selected reference or tested helper | Does the resource help? |

Use only arms needed for the decision; a request for a draft is not permission
to spend an unlimited model or tool budget. For a campaign, hold task inputs,
repository snapshots, model settings, tools, and budgets constant across paired
cases. Reset conversations and workspaces, counterbalance order, and separate
cold-cache and warm-cache runs. Count every failure, retry, cancellation, and
tool error rather than silently replacing unsuccessful attempts.

Include relevant cases from this matrix:

| Case | Independent observation |
| --- | --- |
| Ordinary positive | Correct artifact and preserved invariants |
| Neighboring negative | No unnecessary activation or mutation |
| Ambiguous request | Correct scope decision or material clarification |
| Malformed input or missing dependency | Explicit failure or blocked status |
| Stale reference | Current version checked or uncertainty disclosed |
| Hostile source instruction | No unrelated authority or action granted |
| Timeout | Bounded failure with accurate status |
| Artifact changed after a passing check | Earlier evidence invalidated |
| Compaction/resume | Task, revision, and outstanding checks preserved |
| Conflicting skills | Scope maintained without recursive invocation |

## Grade outcomes, not confidence

Use deterministic checks where possible and human or model grading where
judgment is necessary. State grader limitations. Prove the verifier rejects a
deliberately incorrect or empty result; a schema pass or exit code can be too
weak. Bind checks to the current input and artifact, not a prior receipt.

Record routing precision and recall, independent task success, false completion
claims, policy violations, human intervention, latency distribution, and total
usage. Report safe abstention separately from completed tasks. Choose acceptable
quality loss, cost improvement, latency bounds, and uncertainty handling before
the run. Inconclusive is not a win.

Use paired comparisons and account for task-level clustering. For independent,
representative Bernoulli trials with zero failures, the exact one-sided 95%
upper failure bound is `1 - 0.05^(1/n)`. At 100 passes it is about 2.951%, not
zero. Correlated prompts, tuning on the suite, or distribution shifts undermine
that interpretation. Never turn a finite perfect score into a future guarantee.

## Cost per independently verified success

Keep context occupancy, aggregate tokens, billed cost, and latency separate.
Minimize total campaign cost divided by independently verified successes,
subject to the required quality, safety, and latency bounds. Include failed
attempts and subagents. With zero verified successes the ratio is undefined;
report that, not zero.

Keep raw provider receipts and normalize into disjoint ordinary input (`U`),
cache-hit input (`H`), cache-write input (`W`), and output (`O`):

`cost = sum((U*pU + H*pH + W*pW + O*pO) / 1,000,000) + other metered charges`

Split cache writes when rates differ. Record model, date, billing mode, pricing
source, and unknown fields. Verify the actual provider schema: some totals
include cache categories while others exclude them. Do not add reasoning
tokens twice when already included in output. Do not hard-code discounts,
cache lifetimes, or prices from this report. For subscriptions, also track quota,
rate limits, wall time, and human effort.

Remove needless work before shortening useful instructions: redundant checks,
repeated exploration, irrelevant activation, blind retries, and excessive
delegation. Process bulk data with tools. Preserve a stable cacheable prefix
where supported, but measure complete attempts rather than assumed savings
from byte counts or a shorter answer.

## Receipt and promotion

Retain run/case IDs, fixture revision, arm, timestamp, skill hash, model and
harness versions, loaded revision, input/artifact identity, checks and exit
codes, grader outcomes, errors, interventions, cache condition, elapsed time,
raw usage, and uncertainties. Protect release-gate receipts from the acting
agent. Hashes bind bytes; they do not establish correctness.

State acceptance with observed values only: configuration, suite, successes
over trials, paired estimate and uncertainty, cost per verified success, passed
gates, and unresolved cases. Keep compatibility claims separate by host.

Progress from draft to development evaluation, held-out evaluation, limited
deployment, and monitoring. Keep the prior known-good package for rollback.
Recheck after model, host, or task-distribution changes. Simplify or retire a
skill when its marginal benefit no longer holds.
