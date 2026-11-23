# Sources, evidence and maintenance

Researched 2026-10-17. Version 0.2.0. This skill packages a proposed workflow
around documented product capabilities and a small direct-browser baseline.
It does not claim benchmarked design quality, improved model performance,
automatic routing accuracy, or unattended reliability.

## Primary sources

| Source | Relevant evidence | Application and limits |
| --- | --- | --- |
| [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) | Clear/direct instructions, motivating context, examples, XML separation, long-context placement, structured state and verification | Applied to briefs and recovery; hosted UI does not expose arbitrary system/API settings |
| [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) | Specific frontend direction, dense visual inputs, pasted-content provenance, unattended runs need outcome checks | Conditional guidance for that model; preserve the user's selection and recheck other models |
| [Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design) | Design as an Artifacts template; audience/goal/layout/content prompts; chat, inline comments, direct canvas edits; artboards/layers and keyboard; exports and shared usage | Capability map, not a stable selector contract; some article tables/lists were absent in text extraction |
| [Set up your design system](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design) | Brand systems from supplied sources; product component sync through Claude Code; current and legacy workflows coexist in the article | Browser skill uses observed uploads/selection, not an invented browser `/design-sync` |
| [What are artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) | Artifact templates, editing, storage, app connections and private work | Design is one template; a generic HTML artifact/MCP App is not the same authoring surface |
| [Get started with Claude Docs](https://support.claude.com/en/articles/16923645-get-started-with-claude-docs) | Dedicated Docs authoring and Word/PDF/Markdown/Google Docs export guidance | Verify account/editor formats and exported document fidelity |
| [Share artifacts](https://support.claude.com/en/articles/9547008-share-artifacts) | Private by default; access levels and plan/org restrictions; invitations change access | Export and sharing are distinct; use current UI and user authorization |
| [Migrate standalone Design](https://support.claude.com/en/articles/17440474-migrate-from-standalone-claude-design-to-claude) | Design lives in Claude; standalone site closes December 14, 2026 | Target Artifacts for new work; migration is separate authorized work |
| [Claude Design launch](https://www.anthropic.com/news/claude-design-anthropic-labs) | Original import, web capture, adjustment controls, collaboration, export and handoff concepts | Historical product announcement; do not promise every original feature on today's surface |

The official guide's general recommendation to request more features is not
carried over as unbounded scope expansion. The user's named deliverable and
acceptance criteria control what is built. Similarly, suggested limits on
automatic model continuations are not a replacement for the host's goal and
stop rules; change the approach on a stall rather than resend indefinitely.

## Firsthand baseline

In this session before authoring the package, OmO created one private dashboard
through the Artifacts Design template and another through Claude Code `/design`.
Only the direct browser route is required by this skill.

Observed:

- Existing signed-in attached Chrome could create and inspect a Design artifact.
  A different browser profile was signed out, so "browser installed" did not mean
  "Claude signed in." No credentials were copied.
- The Design template created an empty canvas before the first prompt. Asking
  for a *new* design then created another artifact instead of filling that canvas.
  This motivates capturing the target URL and saying "edit this artifact."
- The UI exposed artboards, layers/properties, Play on canvas/fullscreen,
  inline comment controls, tweaks on one design, and private sharing.
  Merely seeing a control is not an end-to-end test of all its features.
- `Share > Export` offered HTML, PDF and PNG on the tested Design surface.
  HTML downloaded and opened independently with no observed external resource
  requests. Both downloaded dashboards passed a native-keyboard Add task test.
- Resizing to a real 390 CSS-pixel viewport reflowed both exports, but both
  lacked viewport metadata. True mobile emulation used a 980px layout instead.
- A browser `fill` action first failed in the rich composer. Later iframe form
  submissions did not change the state despite text appearing in the input.
  Independent exported tests with native keyboard input succeeded, so those
  failures were not enough to diagnose generated code as broken.
- A long browser evaluation waiting for completion held its session; another
  command was refused until it finished. Waiting and acting need coordination.
- The CLI returned raw Design files that required a runtime; standalone export
  still used the browser. No custom MCP server was installed or benchmarked.

The two runs used different default models and one sample each. Timing was not
a controlled comparison and is not used as a performance guarantee.
Private artifact URLs/account information are intentionally not shipped here.

## Artifacts expansion evidence

A later read-only inspection of the actual signed-in `claude.ai/artifacts`
chooser showed **Docs (New)**, **Slides (New)**, **Design (New)** and
**Dashboard (Beta)**. No artifact was created or changed in that inspection.
The central Artifacts guide also identifies Docs/Slides/Design templates and a
Dashboards beta. Official search evidence describes PowerPoint/PDF/editable
Google Slides exports for decks; the Docs guide documents Word/PDF/Markdown/
Google Docs export. Some attempted article URLs returned not-found pages; those
were not used as evidence for a capability.

Docs, Slides and Dashboard generation, full editor features and account-specific
exports were not live-tested in this expansion. Their recipes require observing
the actual surface and checking the actual output; Dashboard export/refresh
formats are intentionally not promised from a chooser-only observation.

## Verification and maintenance

Helper tests cover local operation/revision/evidence gates, not Claude's remote
semantics. Package/discovery tests cover parsed metadata and installation, not
implicit model selection. A manual workflow walk is not a new full live run.

After an Artifacts UI/product change, recheck each supported template's creation versus revision,
save/completion signals, system selection, Play, export formats and identity.
After a browser engine change, recheck input events, frames, screenshots,
downloads, watches and cleanup. After helper changes, run its Node tests and the
repository's `npm run check`. After prompt/procedure changes, manually exercise
create, revise and resume paths before claiming live reliability.
