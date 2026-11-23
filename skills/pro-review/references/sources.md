# Design and evidence

## What this skill is

OmO Pro Review scopes a change set, sends a complete brief to GPT-6 Pro
through our own ChatGPT browser transport (Pro checked before send and on
ChatGPT's record of the answer), harvests the report artifact,
machine-checks it, and verifies every finding locally before reporting.

Pieces:

- `SKILL.md` - the conductor workflow.
- `references/pro-engine.md` - the transport, the two Pro proofs, sign-in, and recovery.
- `references/review-brief.md` - how to compose the brief.
- `references/report-template.md` - the report contract the client must fill.
- `references/bridge.md` - the optional workspace bridge.
- `scripts/handoff.mjs` - zero-dependency scope/brief/verify/status engine.
- `scripts/pro-engine.mjs` - `plan`, `run` and `recover` for the Pro engine.
- `scripts/chatgpt-transport.mjs` - our own browser transport (`login`, `check`, `status`).
- `scripts/zip.mjs` - the dependency-free, deterministic scope zip.
- `scripts/bridge.mjs` - optional loopback MCP server that serves one verified
  handoff to ChatGPT over Secure MCP Tunnel ([bridge.md](bridge.md)). Official
  sources: OpenAI's Secure MCP Tunnel guide
  (developers.openai.com/api/docs/guides/secure-mcp-tunnels), the custom MCP
  server guide (developers.openai.com/api/docs/guides/custom-mcp-server), and
  github.com/openai/tunnel-client (Apache-2.0).

## Why it is built this way

- **One reviewer, one Pro-only route.** No other client can attest to a GPT-6
  Pro review; transport failure must not become a different reviewer.
- **Artifacts, not transcripts.** Console markers can be satisfied by the echo
  of the prompt. The report file written by the client is the only trustworthy
  completion signal.
- **Threat model of `verify`.** Sixteen adversarial Pro rounds showed that an
  ad hoc Markdown reader can always be fooled into reading less than a renderer
  shows. `verify` therefore accepts only a narrow grammar and rejects everything
  outside it. It protects against incomplete or malformed reports from a
  cooperating reviewer; it does not (and cannot) stop a reviewer from hiding its
  own findings, which omission would achieve anyway.
- **Machine-checked contract.** The section list, verdict vocabulary, findings
  table, and nonce live in `handoff.mjs`; a report that does not satisfy them is
  rejected instead of being summarised as if it were complete.
- **Explicit scope.** Hazards are excluded by rule with a recorded reason
  (secret-shaped paths, binary content, oversized files, generated and log
  shaped files) so that nobody has to remember which paths must never leave the
  machine.
- **Selection evidence is not attestation.** The checked GPT-6 row at Pro effort
  in the picker, and the `model_slug` in ChatGPT's record, are ChatGPT's own
  statements, not independent proof of the backend that produced an answer.

## Verification

- Bundled tests: `node --test skills/pro-review/test/*.test.mjs` (transport,
  transport home, bridge).
- The transport checks the live picker before submitting and refuses
  publication without saved same-session evidence; live runs are recorded in
  [pro-engine.md](pro-engine.md#evidence).

## Boundaries

- No model, provider, or auth configuration is added or modified.
- The Pro engine drives ChatGPT in the user's default Chromium browser, on a
  dedicated profile, through our own
  zero-dependency transport (see [pro-engine.md](pro-engine.md)) because the Pro tier
  has no API. Its launch flags and page flow were adapted from steipete/oracle (MIT);
  no third-party code runs. Scope, brief, report contract, verification and the
  credential boundary are ours too.
- Review-only by default: findings and the smallest next step, nothing else,
  unless the user separately asks for implementation.
