# Artifact type routing and execution recipes

Read before the shared workflow. The signed-in Artifacts hub was observed on
2026-10-17 offering **Docs**, **Slides**, **Design**, and **Dashboard (Beta)**.
These are separate authoring surfaces with shared private artifact links and
conversation-based iteration, not four names for the Design canvas.

The invocation remains `$claude-design`. Specify the type in `brief.md`, the
session ledger (`init --type ...`) and `progress.md`. If the user requests
several types, keep separate artifacts and run directories, with one umbrella
native todo plan and shared source packet. A deck may summarize a dashboard,
but it is not the same artifact or an automatic synchronized view.

## Route by requested outcome

| Outcome | Type | Examples of needed inputs | Distinct validation |
| --- | --- | --- | --- |
| Written deliverable | `docs` | Reader, purpose, outline, sources, exact facts, tone, formatting | Factual support, structure, tables, pagination and requested file formats |
| Presentation or PowerPoint | `slides` | Audience, decision, talk length, slide count, narrative, evidence, brand/template | Every slide, legibility, charts, presentation order and actual PPTX |
| Screen/flow, product mockup or prototype | `design` | Users, components/tokens, screens, responsive rules, interaction states | Canvas/reference fidelity, Play, keyboard and exported behavior |
| Functional data dashboard | `dashboard` | Source/schema, grain, metric definitions, filters, freshness and access | Numerical reconciliation, chart semantics, filter interactions and data states |

Choose Design for a dashboard *layout mockup* with illustrative data; choose
Dashboard for a working analytical view. If this distinction changes the result
and the request/codebase cannot resolve it, ask that one question. Do not
silently substitute a generic HTML app when the named template is unavailable.

## Docs

### Brief and create

Relay the reader and intended decision, document type and length, required
outline, exact claims/numbers, sources and source priority, tone, tables/
diagrams, existing formatting/template, and requested output formats.
Distinguish supplied facts from assumptions and proposed text.

Open **Docs**, capture the created artifact, and ask Claude to edit that same
document. For substantial work, establish the outline and key claims before
polishing typography. Use the current editor's actual heading, list, table,
formatting, selection and revision controls; do not assume a canvas/artboard UI.

### Iterate and validate

Target the named section or selected passage. State what to preserve: approved
claims, wording, headings, table structure, length and citation style. Verify
the revision in the document, not only the chat reply.

Check all requested sections, factual/citation support, calculation consistency,
table readability, links, heading/list hierarchy and any exact required copy.
Inspect long/empty table cells, page breaks, headers/footers and images where
applicable. Check exported pagination separately from the web editor.

The official Claude Docs guide documents Word (`.docx`), PDF, Markdown and Google
Docs export; verify what this account/editor currently offers. For a Word
request, deliver and open a real DOCX, not HTML renamed `.docx`. Check headings,
tables, lists, links, images and page layout after conversion. For Markdown,
inspect the structure and content fidelity, not page geometry. Exporting to
Google Docs is an external creation/write, not merely a local download; perform
it only when that destination was requested and follow host authorization rules.

### Resume

Record the current section/selection, accepted outline and claims, source
packet, last requested revision and pending export. Reopen the same document
and inspect saved content before repeating an edit or exporting again.

## Slides / PowerPoint

### Brief and create

Relay audience, purpose/decision, presentation duration, slide count or range,
aspect ratio, story arc, must-include claims and source data, brand/template,
visual references, chart semantics, speaker-note expectations, and delivery
format. Prefer one clear takeaway per slide with evidence supporting it.
Keep exact figures and the provenance needed to check them.

Open **Slides** for decks, including requests that say PowerPoint or PPTX.
Capture the artifact URL; ask Claude to edit it rather than creating a second
deck. Establish slide order and narrative, then refine layouts and content.
Use the observed slide editor, selection, theme, chart, presentation and notes
controls where available. Do not promise notes, animations or template import
unless the current editor actually supports the requested operation.

### Iterate and validate

Name the slide by number **and title**; numbers alone can change when slides
are inserted. Preserve accepted slides and shared theme while fixing the target.
Render and inspect every slide, including title, appendix and closing slides.
Check text overflow, contrast, alignment, font sizes, source labels, chart axes,
units, image crops and visual continuity. Review presentation order and any
requested notes, links or animations through the actual presentation surface.

For PowerPoint, require a genuine editable **`.pptx`** using the current export
controls. The central Artifacts documentation/search evidence describes
PowerPoint/PDF and editable Google Slides exports; recheck availability in the
actual Slides editor. PDF is a useful preview, not a replacement for PPTX.
An HTML prototype, static-image deck or a file renamed `.pptx` does not satisfy
an editable-deck request.

Inspect the PPTX's file/container format and slide count, then render every
exported slide and compare against the artifact. When the user requests
editability, inspect representative title/body/chart elements in a real deck
viewer/editor rather than inferring it from the extension. Verify notes if
requested, fonts/fallback, assets and links. Office automation belongs to the
host's `moffice` skill when installed and requested; other renderers may provide
visual checks but do not establish editability by themselves.

If a renderer/editor is unavailable, mark that export check blocked and say
exactly what remains unverified. Never claim PowerPoint compatibility from a
successful download alone. A Google Slides destination is an external write
requiring the user's requested destination, not an automatic fallback.

### Resume

Record deck identity, theme, accepted story/slide inventory, current slide title,
latest generated/exported revision and pending operation. Re-enumerate slides
after reopening; do not revise an old numeric index blindly.

## Design

Use the shared design brief and [capability map](capabilities.md): selected
design system, uploaded references, named pages/artboards, layers/properties,
inline comments, direct edits, meaningful tweaks, saved alternatives and Play.
Validate every requested screen/state/viewport, keyboard interaction and export
using [validation.md](validation.md).

The baseline Design editor exposed HTML/PDF/PNG. A request for PowerPoint routes
to Slides rather than assuming Design exports a deck. Product design-system
sync through Claude Code remains optional external tooling, not a requirement
for this direct-browser skill.

Resume on the same artifact with current page/artboard, selected system, last
saved revision/time, pending operation and acceptance matrix.

## Dashboard (Beta)

### Brief and create

Relay the analytical questions and audience, actual data or an authorized
accessible source, schema, row grain, unique keys, time range/timezone,
currency/units, refresh/freshness expectation, metric formulas, aggregation and
denominators, null/duplicate rules, default filters, chart choices, drilldowns,
cross-filter behavior, empty/error states and data-access constraints.

Use a scoped synthetic or redacted dataset when real data is not necessary.
If data is missing, agree on a schema and label sample data clearly; never
present invented values as live analysis. A screenshot of a chart is not its
underlying dataset. Upload supported files through the observed controls and
verify filenames/schema; do not assume a connector exists or is authenticated.

Select the actual **Dashboard** template. Its Beta label means capabilities
may vary: inspect available data inputs, chart/table/filter controls, refresh,
download/export and sharing rather than borrowing Design's controls. Connecting
a real data source or enabling ongoing refresh needs the user's requested scope
and host authorization. Do not change account integrations just to finish a demo.

### Iterate and validate

First validate schema and metric definitions; then validate the presentation.
Compute expected totals independently from the supplied data, with the host's
data tools if available. Compare displayed values to those totals and to
hand-checked rows. Verify aggregation grain, time buckets, percentage
denominators, rounding, nulls/duplicates, timezone and units.

Exercise each requested filter, reset, drilldown, sort and chart interaction.
Check the corresponding table/chart/KPI changes together, including combined
filters, no-results, stale/error/loading states and long labels. Do not report a
dashboard correct because it looks attractive or a filter menu opens.

Use the current template's actual export/download options. No particular
Dashboard format or live-refresh/export behavior was established by the
chooser-only inspection. A snapshot should state filters and "as of" time;
if data export is requested, compare exported rows/totals to the selected view.
A static PNG/PDF is not a functioning interactive dashboard.

### Resume

Record source/version or content hash, schema and metric definitions, filter
state, time range/timezone, freshness timestamp, accepted views, last change and
pending operation. On return, check whether the data or upstream source changed
before reusing old numerical or screenshot evidence.

## Type identity and availability

Use `init --type docs|slides|design|dashboard`; the default remains `design` for
existing invocations. On resume trust the recorded type only after checking
the actual artifact. If an older ledger lacks type, inspect the artifact and
brief before selecting a recipe. A type change requires a new linked artifact
and run, not carrying the old artifact's checks onto a different deliverable.

The signed-in chooser inspection verified names and Dashboard's Beta badge,
not new document/deck/dashboard generation or their account-specific exports.
Read [sources.md](sources.md) for the exact evidence limits. Unsupported access
or exports are blockers, not permission to silently change the user's format.
