# Oracles and generated inputs

Condensed from the `fdd` skill (0.1.3). Use `fdd` itself for a full fuzz
campaign whose deliverable is the harness.

## Choose the boundary and the claim

- Test the narrowest entry point that can expose the failure: decoder,
  serializer, validator, protocol handler, transformation or state machine.
- Write down what each assertion proves. Round-trip, idempotence and
  conservation can pass when encoder and decoder share a bug; pair them with a
  spec-derived expected value, an independent model or the public consumer.
- Assert documented rejection of malformed input separately from acceptance.
- A differential mismatch is a finding, not proof of which side is wrong.

## Generators

- Build valid, boundary and invalid families separately. Cover emptiness,
  extremes, encoding, nesting, truncation, duplicate fields and operation order
  only where they apply. Keep enough valid structure to reach deep logic.
- Stateful targets: generate operation sequences against a small independent
  model (for a queue, a plain FIFO array) and check postconditions after each.
- Use the project's existing fuzz engine or property library. Without one, a
  seeded deterministic generator in the normal test file is enough; call it
  property testing, not coverage-guided fuzzing. Do not install a framework for
  one generator.

## Calibrate the oracle

Show the assertion rejects one representative wrong output or defective
implementation in an isolated fixture. Example for a JSON string-array codec:

```text
relational: decode(encode(v)) equals v
conformance: JSON.parse(encode(v)) equals v
calibration: encode prefixes "PRIVATE:", decode strips it
expect: round-trip still passes, conformance fails -> the oracle has teeth
```

## Budget and counts

- Fix the seed, case count, input size, operation depth, per-case and overall
  deadline. Default to a short local campaign.
- Count attempted, executed, discarded and failing cases per property and per
  family. An asserted expected rejection counts as executed; a filtered input
  does not. Zero executions or an unexercised family is incomplete coverage,
  never a pass.

## Failures

1. Save the original failing input or operation sequence, not only the seed.
2. Shrink with the same oracle and failure class; a smaller input that fails
   differently is a separate finding. Keep the original if shrinking loses it.
3. Classify: harness defect, unspecified behavior or target bug.
4. Reproduce the minimized case on the unfixed code, add it as a deterministic
   regression next to related tests, fix, replay, rerun the campaign.

Report the replay command, seed or corpus path, counts, failures before and
after, and the input domains left untested.
