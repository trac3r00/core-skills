---
name: dft
description: "Dogfood the built product through its real entry points and report journey failures. Use when asked to dogfood a release. Not for code review (review-work)."
version: 0.1.3
license: MIT
metadata:
  status: "unbenchmarked"
  agentskills:
    tags: [dogfooding, qa, release, journeys, testing]
---

# DFT - Dog-Food-Testing

Use what will ship as its intended user. A successful build or a mocked test
does not show that someone can finish their job.

## Inputs and output

Use the target product/build, intended user and job, README onboarding,
applicable `Rules.md` and `AGENTS.md`, current roadmap, and acceptance criteria
or LoE when present. Discover the actual shipped entry point and build identity.

Produce a journey report with actual observations, evidence, defects, blocked
steps, and cleanup. Use an existing QA report location; otherwise return the
report in the reply unless a persistent artifact is requested.
Testing alone does not authorize changing product behavior.

## Prepare representative use

1. Read how a user installs and starts the product. Identify whether testing
   source, a development server, a packaged candidate, or an installed release.
   Prefer the release candidate for release claims. Record artifact digest,
   revision, uncommitted changes, version, platform, and relevant configuration.
   Equal Git revisions do not establish equal working trees or deployed bytes.
2. Choose a small set of jobs from actual goals, not the easiest demo. Cover the
   primary job end to end, a relevant recoverable failure, and persistence or
   repeat use where applicable. Do not invent personas or feature requirements.
3. Define each journey before running it: user goal, initial state, exact entry
   point/actions and data, expected result, independent evidence, and cleanup.
   Include fresh onboarding for new-user claims; use an isolated profile rather
   than clearing an existing user's data.
   For state-changing jobs, establish the initial value and a distinguishable
   test result before acting. Verify this action produced the expected delta,
   not merely that an old file, cached response or prior record already exists.
   Use an isolated destination or task-specific marker when appropriate.
4. Use representative local fixtures or an authorized test account/environment.
   Keep fixtures distinct from production data. Stop before an external write,
   purchase, send, deploy, or destructive step unless this session authorizes it.
   Report that journey blocked rather than replacing the step with a mock pass.

## Execute through the real surface

Use the installed host tool for the actual surface:

| Product surface | Required observation |
| --- | --- |
| CLI | Invoke the shipped command; inspect exit, stdout/stderr, and output data |
| Terminal UI | Operate the real TUI; observe rendered state and interactions |
| Web | Operate the actual page in a browser; inspect results and relevant errors |
| Desktop/mobile | Operate the named app/device; verify visible and persisted state |
| API/library | Use its public consumer interface with a realistic caller |
| Build/developer tool | Use it on a representative project and inspect its output |

Load the matching skill only when the surface needs it: `browser` for web,
`visual-qa` for rendered UI judgment, and the host's desktop-control skill for
native apps. Do not substitute an internal API call for an unavailable
UI. Record missing tool access as a limitation.

1. Follow documented setup as a user would. Record undocumented fixes,
   confusing states, and manual workarounds; a journey requiring one is not an
   unqualified pass.
2. Execute concrete actions and capture outputs/screenshots at decisive steps.
   Register a `tool.monitor` or exact event wait before triggering async
   actions, with bounded deadlines. Do not add sleeps or retry a failed
   journey until it happens to pass.
3. Check the resulting data independently. Reopen, reload, restart, reimport,
   or consume the artifact through another supported path when durability or
   interoperability is part of the job. A toast alone does not prove persistence.
   Reopening through the same product may share an exporter/importer defect;
   it proves only the observed round-trip. For correctness or interoperability,
   compare with specification-derived fixture values or an independent supported
   consumer. Two components agreeing on a wrong total is not independent proof.
4. Exercise the chosen failure and recovery. Verify the error is actionable and
   that data remains intact. Preserve diagnostics before cleanup.
5. If fixing is also authorized, reproduce, make the smallest fix, run related
   automated tests, and repeat affected journeys against the rebuilt candidate.
   Do not present observations from the old build as evidence for the new one.

## Journey report

```text
Candidate identity / environment:
Evidence binding: criterion meaning/version; journey/verifier; fixture/config IDs
Goal or EXP ID | Journey and entry point | Expected | Observed | Verdict | Evidence
...
Defects: severity, user impact, exact reproduction, expected vs actual
Workarounds and friction:
Blocked or unrun journeys:
Cleanup and retained artifacts:
```

Verdicts are PASS, FAIL, or BLOCKED. Separate functional failure from usability
friction and distinguish new regressions from pre-existing defects. Do not
collapse unrun steps into PASS because unit tests are green.

Example: export invoices through the shipped UI, reopen the file with the
supported importer, compare invoice IDs and totals, then test an unwritable
destination and confirm the existing file is unchanged.

## Finish

Stop after every selected journey has a verdict and evidence or a precise
blocker. Stop owned processes, remove disposable profiles and fixtures, and
retain only needed evidence in the project's chosen QA directory. Never delete
another user's profile, cache, records, or task artifacts.
Report the exact tested build and limits; dogfooding is not exhaustive testing
or authorization to release. Preflight may reuse evidence only for the same
applicable criterion meaning, journey/verifier, relevant fixtures/configuration,
candidate and environment. Record their identities with the report; the same
EXP ID alone is insufficient after its meaning changes. Invalidate affected
rows when these inputs change, while retaining unaffected evidence. Follow
project freshness requirements without inventing a universal expiry period.

Invoke in OmO: `/skill:dft <candidate and user job>` or `$dft <feature>`.
Example: `$dft dogfood packaged invoice export from onboarding through reimport`.
A request for a static code review alone is a near miss; use `review-work`.

Unbenchmarked. Revisit after escaped user journeys, onboarding changes, or
packaging changes.
