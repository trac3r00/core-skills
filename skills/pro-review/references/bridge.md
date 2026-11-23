# The workspace bridge (optional)

The bridge lets a ChatGPT conversation **read the planned scope on demand** through
a local MCP server, instead of receiving the files as one uploaded bundle. It is
useful when a scope is too large to paste or attach comfortably, or when the
reviewer should follow callers inside the scope at its own pace. It is the same
idea as the community GPT Bridge VS Code extension (DreamURL/GPT-Bridge: a
workspace exposed as an MCP server and reached over OpenAI's Secure MCP Tunnel),
re-built inside pro-review's own guard: no code from that project is used, and the
bridge exposes only the handoff, not the workspace.

The Pro engine (`pro-engine.mjs`) stays the default and the only route with
recorded GPT-6 Pro selection evidence. A bridge review is labelled
**"ChatGPT via bridge; model chosen by the user in ChatGPT, not attested"** in the
final report. Never present it as an attested Pro review.

## What the reviewer can do

| tool | kind | effect |
| --- | --- | --- |
| `get_review_scope` | read-only | question, bound brief with the report contract and nonce, scoped file list |
| `read_file` | read-only | one scoped file with line numbers (other paths are refused) |
| `search_text` | read-only | literal search across the scoped files |
| `submit_report` | write | contract-checks the report off to the side; publishes it to this pass's report path with exclusive create only when it passes |
| `propose_patch` | write | stores a unified diff touching only scoped files under `bridge/proposals/NNN.patch` with a `git apply --check` result; never applies it |

ChatGPT treats tools without `readOnlyHint` as write actions and asks for
confirmation, so both write tools prompt the user in the chat.

Boundaries enforced by `scripts/bridge.mjs`:

- At start it re-verifies every file of the pass with the Pro engine's own manifest
  check (containment, path policy, regular file, recorded SHA-256) and serves that
  snapshot; a file changed since `plan` refuses the whole bridge (re-plan).
- Loopback only (`127.0.0.1`), `POST /mcp`, stateless JSON responses. Every request
  needs `Authorization: Bearer <token>`; the token is new on each start, stored as
  `bridge/authorization` (mode 0600) and removed on exit. The server stops after
  `--ttl` minutes (default 180).
- Every tool call is appended to `bridge/access.jsonl` (tool, path or query, ok), so
  you can see what the reviewer read.
- The repository is never written. Applying a proposed patch is the user's decision
  (`git apply <handoff>/bridge/proposals/001.patch` after reading it).

## One-time setup (human-only steps)

These steps create credentials and change account settings, so the user does them;
an agent never creates keys, tunnels, or plugins on the user's behalf.

1. Install the official client: `brew install openai/tools/tunnel-client`.
2. In [Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels)
   create a tunnel associated with the ChatGPT workspace you review in; note the
   `tunnel_…` id. Create a runtime API key with Tunnels **Read + Use**, dedicated to
   this purpose, and keep it in the environment as `CONTROL_PLANE_API_KEY` (never in
   a file the bridge or a repository can read).
3. In [ChatGPT plugins](https://chatgpt.com/plugins), **Add custom MCP server**,
   choose **Tunnel** with that tunnel and **No authentication** (tunnel-client adds
   the bearer header locally). Do this while the tunnel is running (below).

## Each review

```sh
# 1. Plan as usual (step 2 of SKILL.md); the bridge uses the same manifest.
node "$PRO_REVIEW_DIR"/scripts/bridge.mjs serve --manifest "<dir>/manifest.json" [--pass N]

# 2. Once per handoff: write the tunnel-client profile, then run it.
node "$PRO_REVIEW_DIR"/scripts/bridge.mjs tunnel-profile \
  --manifest "<dir>/manifest.json" --tunnel-id tunnel_… > ~/.config/tunnel-client/pro-review.yaml
tunnel-client doctor --profile pro-review --explain
tunnel-client run --profile pro-review

# 3. Print the chat message.
node "$PRO_REVIEW_DIR"/scripts/bridge.mjs prompt --manifest "<dir>/manifest.json" [--pass N]
```

The profile references the API key as `env:CONTROL_PLANE_API_KEY` and the header as
`file:<dir>/bridge/authorization`; it holds no secret itself. Because the header
file lives in the handoff directory, regenerate the profile for each new handoff.

In ChatGPT: start a new chat, choose the model (Pro, if the plan offers it),
`@`-mention the plugin, paste the prompt, and approve `submit_report` when asked.
Then continue with step 4 of SKILL.md (`handoff.mjs verify`) on the pass's report
path. Stop `serve` and `tunnel-client` when done.

## Limits

- Whether a given ChatGPT model can call custom MCP plugins depends on the plan,
  workspace settings and the model; check it in the chat before relying on it.
- Usage counts against the ChatGPT plan's own limits and policies. The bridge is a
  review channel for one planned scope, not a way to route general coding work.
- ChatGPT's answer is not attested by the bridge: the report says which model the
  user selected; treat it as self-reported.
- Live end-to-end use needs the human setup above; the bundled tests cover the MCP
  server, scope and token boundaries, patch storage and report publication locally.
