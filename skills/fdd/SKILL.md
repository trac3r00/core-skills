---
name: fdd
description: "Fuzz-driven development: generated inputs break invariants; shrunk repros become tests. Use for fuzzing parsers or state machines. Not for crashes (debugging)."
version: 0.1.3
license: MIT
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [fuzzing, property-testing, parsers, state-machines, testing]
---

# FDD - Fuzz-Driven-Development

Generate counterexamples before trusting the implementation, then keep the
smallest failing case as a regression. Random input alone is not a test oracle.

## Inputs and output

Identify the authorized target, expected contract, applicable `Rules.md` and
`AGENTS.md`, neighboring tests, runner, and available fuzz/property tools.
Use an existing LoE contract if present; do not require one to exist.

Output a bounded fuzz harness in the repository's normal test location,
replayable minimized regressions, in-scope fixes when authorized, and evidence.
If the user requested investigation only, return findings and reproducers
without editing production code.

## Define a falsifiable target

1. Choose the narrowest boundary capable of exposing the suspected failure:
   decoder, serializer, validator, protocol handler, transformation, or state
   machine. Record the actual entry point and supported input domain.
2. State the claim each oracle can establish. Relational properties such as
   round-trips, idempotence and conservation are useful invariants, not independent
   proof of contract conformance: cooperating components may share the same bug.
   Ground correctness in specification-derived expected values, an independent
   model, or the specified public consumer. Where representation/interoperability
   matters, supplement relational checks with that independent evidence.
   "Does not throw" is insufficient when correctness matters. Assert documented
   rejection of malformed input separately. Differential disagreement is a
   finding, not proof which side is wrong.
3. Build valid, boundary, and invalid generators separately. Cover emptiness,
   extremes, encoding, nesting, truncation, duplicate fields, and operation order
   only where relevant. Preserve enough valid structure to reach deeper logic.
   A stateful generator must model preconditions and assert postconditions.
4. Use the project's native fuzz engine or existing property library first.
   Do not install a new framework for one simple seeded generator. If no native
   fuzzer exists, a deterministic generated-case test is acceptable; label it
   property testing, not coverage-guided fuzzing.
5. Calibrate the oracle with one representative incorrect output or defective
   implementation in an isolated fixture. Confirm it actually rejects the
   violation, not merely that the harness runs. Reuse known failing regressions
   when they demonstrate this; no mutation-testing framework is required.

## Run the development loop

1. Record runner/version, seed or exact corpus entry, generator configuration,
   target revision and dirty changes, platform, and exact replay command.
   Engine-managed mutation must save the actual failing bytes or operation
   sequence; a seed alone may not reproduce across versions.
2. Choose explicit budgets appropriate to the target: case count, input size,
   operation depth, per-case deadline, overall deadline, memory and workers.
   Default to a short local campaign, not an unbounded background stress test.
   Isolation must prevent inputs from reaching production services or user data.
3. Run known regressions, then the bounded campaign. Watch a long campaign with
   `tool.monitor` on its completion line instead of polling. For async targets,
   subscribe to the exact event before triggering it and use bounded timeouts; no fixed-sleep luck.
   Count attempted, executed, discarded and failing cases per property and
   required input family. Count execution only when the property assertion runs.
   An asserted expected rejection counts; filtering an input out does not.
   Zero executions or an unexercised required family is incomplete coverage,
   never a successful campaign. Repair generator/precondition mismatch or
   explain the gap; do not invent a universal discard-rate threshold.
4. On failure, preserve the original input, then shrink with the same oracle:
   shorten data, simplify structure, or remove operations while retaining the
   failure. Distinguish a harness defect, unspecified behavior, and target bug.
   Preserve the violated property, relevant input-domain preconditions and
   failure class during shrinking. A smaller input that instead triggers an
   unrelated parse error is a different finding, not a minimized reproducer.
   Keep the original when the minimized case cannot reproduce the original bug.
5. Reproduce the minimized failure against the unfixed target. Add a deterministic
   regression in the existing suite where this behavior belongs. Make the
   smallest contract-preserving fix, then replay it, rerun the campaign, and run
   related integration checks. Never weaken the oracle to make the fix pass.
6. Keep useful small corpus cases under the project's test conventions. Clean
   task-owned temporary corpora, processes, and large logs after retaining the
   required reproducers. Do not commit secrets or raw private user data.

## Concrete oracle example

For a codec whose public wire contract is JSON arrays of Unicode strings:

```text
relational property: decode(encode(values)) equals values
conformance oracle: public JSON parser reads encode(values) as the expected array
calibration: encode adds "PRIVATE:"; decode strips it; round-trip still passes
required rejection: public JSON parsing fails for that incompatible wire
valid families: [], [""], combining characters, multibyte strings, separators
invalid families: truncated JSON, malformed escapes, non-array or non-string values
invalid oracle: the documented rejection, with no partial persisted output
regression: the smallest concrete array or bytes that violated that contract
coverage: 5 attempted / 0 executed / 5 discarded is incomplete, not 5 passes
```

Do not assume the same round-trip property for a deliberately lossy codec.
For a queue, use a small independent FIFO model and generated enqueue/dequeue
sequences rather than comparing the implementation to itself.

## Finish

Stop after the bounded campaign, minimized failures, authorized fixes, and
related checks are complete, or report the precise unavailable dependency.
Report properties and their limits, oracle calibration, generated families,
budget, attempted/executed/discarded/failing counts, seed/corpus path,
replay command, failures before/after, and untested domains. A zero-failure
campaign is evidence within its budget, never proof of absence of bugs.
Do not broaden a parser fix into unrelated hardening.

Invoke in OmO: `/skill:fdd <target and contract>` or `$fdd <target>`.
Example: `$fdd harden the CSV decoder against malformed quoted fields`.
Running an existing unit suite without generated inputs is a near miss; for
crash triage without a fuzz loop, use `debugging`.

Unbenchmarked. Revisit after escaped input classes, nondeterministic
regressions, engine upgrades, or target-contract changes.
