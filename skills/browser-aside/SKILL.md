---
name: browser-aside
description: "Hand this session to Aside's browser chat on this model; resume on return. Use only on $browser-aside or 'continue in Aside'. Not for web automation (browser)."
version: 2.0.3
license: MIT
metadata:
  agentskills:
    tags: [browser, aside, handoff, provider, playwright]
---

# Browser Aside

Aside is the user's AI browser. It has computer use, memory, and the user's logins. This skill turns
this OmO session into the model behind Aside's chat for as long as the user works there. Aside
keeps doing what it does well, and OmO supplies the model, the accounts and the fallbacks. Nothing
inside Aside.app is modified.

## Hand the session to Aside (what `$browser-aside` means)

Call the `aside_handoff` tool once. Its `brief` is everything the Aside chat needs from this
session: the goal, relevant URLs, constraints, what counts as done, and what not to do (for
example "do not submit" or "do not pay").

```
aside_handoff({ brief: "Compare the Pro and Team plans on https://example.com/pricing for 5 seats; the user wants monthly totals. Don't sign up." })
```

It does this:

1. Serves an OpenAI-compatible endpoint from this OmO process (`127.0.0.1:47951`) and registers it in
   Aside as the provider **OmO** (`~/.aside/u/0/models.json`).
2. Points Aside's default model and its model categories at OmO through Aside's own settings API,
   and saves the previous choices.
3. From then on, Aside's requests, including its full system prompt, memory, page context, tool list and
   side calls, run on this session's live model with its fallback chains. Tool calls go back to
   Aside, which executes them. The main chat also gets this session's context and a `return_to_omo`
   tool.
4. Brings Aside to the front.

Then tell the user in a line or two: switch to Aside and start a new chat (**New chat**, or **Ask
Aside** with Option+Shift+B). When they're done, they say so in that chat and it sends them back.
Do not start the task in the terminal.

**Coming back.** When the user says they're done in Aside, the chat answers "go back to your
terminal" and Aside's model choices are restored. This session then gets a message, shown in the
terminal, with the Aside summary, the token and cache stats, what was said and done there
(requests the user stopped are marked), and the path to a full JSONL record. The message is context:
it doesn't start a turn, so don't wait or poll for it; end your turn after the handoff line. Use it when the user writes next, don't pick up stopped requests, and don't
redo what Aside already did. `/aside end` in the terminal ends the handoff the same way, and
`/aside status` shows live stats. With `OMO_ASIDE_DEBUG=1` set, every raw Aside request and every
context sent to the model is saved next to the record.

Aside's memory consolidation ("dreaming") runs after a chat finishes, once 24 hours or 5 sessions have
passed, on that chat's model. It reads a 14-day window: 70k-480k input tokens per run in Aside's own
history. During a handoff it is refused, and Aside records it as an empty run and restarts its schedule.
The next run outside the handoff reads the same 14-day window, so nothing is lost. After 7 days of only
refused runs, the next one goes through OmO. Set `OMO_ASIDE_DREAM=omo` to always run it through OmO.
`OMO_ASIDE_RESIDENT=0` turns off the provider session reuse that keeps long Aside tool loops cheap.

If `aside_handoff` fails, relay its message:

| Message says | What the user does |
|---|---|
| the Aside CLI is not installed | Aside > Settings > Developers > Install Aside CLI |
| connected to another OmO session | `/aside end` in that session, or wait for it to finish |
| select a model first | pick a model in this session (`/model`) |
| port 47951 is in use | free the port, or set `OMO_ASIDE_PORT` to a free port and retry |

## Look at Aside yourself (no handoff)

When OmO itself must read or act in Aside, connect from the eval js kernel instead of
handing the session over. The connection, ref lifetime, disconnects, and the trusted
`omo` input helpers are documented in [driving Aside directly](references/direct-control.md).

## Rules

- **Aside acts as the user.** Purchases, messages, posts, deletions and form submissions need the user's
  explicit request. Put those limits in the brief.
- **Never read credentials.** No cookies, tokens or passwords from pages, from `fetch`, or from
  Aside's files. The browser is already signed in, and that is the point.
- **Leave Aside's settings alone** apart from what `aside_handoff` changes and restores itself.
