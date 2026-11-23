# Choose artifact and Design features deliberately

Read before selecting a feature or when the UI changes. This is a capability
map, not an assertion that every account, artifact type, or rollout has every
control. Observe availability and record unavailable requested capabilities.
The hub offers Docs, Slides, Design, and Dashboard (Beta). Use
[artifact-types.md](artifact-types.md) for their separate workflows and exports.
The canvas/layer/Play map below applies specifically to Design, not every type.
Current Design is distinct from a generic HTML artifact and the retiring
standalone Design site.

| Capability | Use it for | How to operate and validate |
| --- | --- | --- |
| Design template and chat | New screens, broad structure, coherent changes | Select Design, record the empty canvas, then edit it; verify artifact type, name and URL |
| Design systems | Shared tokens, typography, components, brand consistency | Select the named system; inspect representative output against real tokens/components, not merely the selected badge |
| Design-system creation from references | Reusable brand guidance when requested | Supply scoped code/design references, logos and fonts through available controls; review the generated guide and a sample design |
| Reference and asset inputs | Existing product fidelity and realistic content | Attach relevant images/files, accessible URLs or allowed connected sources; confirm successful attachment/access |
| Pages and artboards | Flows, breakpoints, states, design alternatives | Name every screen and arrange/order them intentionally; enumerate them again during QA |
| Layers and properties | Precise text, color, geometry and layout adjustments | Select the actual layer; inspect properties, edit one intended value, verify save and unaffected neighbors |
| Inline comments | Element-specific requested changes | Anchor to the intended component, describe the delta, verify whether Claude applied it; a posted comment alone is not an edit |
| Direct editing | Exact copy changes, resize, align and reorder | Use observed selection and controls; verify responsive and neighboring layout afterward |
| Tweaks/adjustment controls | Repeated variants such as density, accent or component settings | Inspect or request the meaningful control; verify every intended variant in the actual design |
| Play on canvas/fullscreen | Real interaction, navigation and state validation | Enter Play instead of editor selection mode; perform input and verify the resulting state |
| Version preservation/duplicate | Alternative explorations without losing accepted work | Save/duplicate as appropriate, record the new URL or revision, then verify the original remains recoverable |
| Private links and collaboration | Review and, when authorized, comments/editor access | Record the intended audience and role; changing access or inviting a person needs the user's instruction, not just an export request |
| Export | Standalone HTML, print or image deliverables | Inspect available formats, subscribe to download, verify actual file type, content and independent rendering |
| Engineering handoff | Implementation using the current codebase | Export/read actual files, capture reference states and reuse local components; do not require a Claude Code subprocess |

## Design systems and imports

Prefer an existing system appropriate to the target product. Before generating,
verify the system selected in this chat; organization defaults can differ.
If the user requests a new or revised system, use the current UI's supported
chat/attachment workflow and preserve the accepted original where needed.
Applying a system to this design does not authorize changing an organization
default, publishing a system to teammates, or migrating old work.

The official guide describes brand systems from uploads/connected sources and
product systems from React/code through Claude Code's `/design-sync`. This
skill does not pretend the browser offers that CLI command. Instead, attach
scoped tokens/components or use an existing synced system. If that is not
sufficient, report the exact missing capability rather than silently invoking
Claude Code or reverse-engineering internal APIs.

Inspect the UI before promising file formats or connectors. The original launch
announcement described codebase/web capture and document inputs plus Canva,
PDF, PPTX and HTML exports; current Design, Slides, and legacy surfaces differ.
In the direct Design baseline, HTML/PDF/PNG were visible. PPTX or Canva must be
verified on the requested surface; do not turn a Design artifact into Slides
without the user's request.

## Flows, controls and revisions

For a flow, specify navigation edges and preserved state, not just artboard
names. For responsive work, specify both container behavior and viewport sizes;
multiple fixed artboards alone do not prove responsiveness. Use the properties
panel/layer list for selection where the canvas is ambiguous.

Keep references at adequate resolution. Ask for actual interactions when they
matter: an Add action should create a visible item, a form should validate,
and navigation should reach the right screen. Label simulations as simulations;
do not connect real accounts or send external data merely to demonstrate a UI.

Tweaks are useful only when the variation is meaningful. Test all requested
values. Direct edits and chat edits can affect one another; re-read the saved
design before applying a stale correction. Never let two OmO agents mutate one
artifact concurrently.

## Persistence and availability

Record names plus URLs and any visible revision/modified time. Do not invent
a version field when the UI has none. Prototype-local state can reset on reload;
test the persistence the brief actually requires.

Quota, disabled organization features, sign-in, unsupported formats and missing
edit rights are concrete blockers. Keep the brief and checkpoint, finish
independent work, and ask only for the required human action. Do not enable
extra usage, change model routing, or bypass a denied browser action.
