# Validate the artifact, not Claude's description

Read before generation and again before reporting. The host agent owns the
verdict. Claude's self-check and a subagent's opinion are evidence to evaluate,
not substitutes for observing the requested outcome.

## Plan the matrix

Read the type-specific validation in [artifact-types.md](artifact-types.md):
Docs needs content/structure/document checks; Slides needs every slide and
actual editable PPTX checks; Dashboard needs numerical reconciliation and
filter/data-state checks; Design needs screens, Play and responsive checks.
Do not use the Design-only example matrix as a substitute for those checks.

Write stable acceptance IDs in `brief.md` and initialize the ledger with exactly
those IDs. Include the complete set of requested sections, slides, pages/artboards,
data views, viewports, states, interactions and export formats. Give each independently failing
requirement its own ID; a broad "QA passed" row hides missing coverage.

| Example ID | Required observation | Evidence |
| --- | --- | --- |
| content-overview | Exact required copy, data, hierarchy and primary action | Screenshot plus semantic snapshot |
| layout-phone | Requested narrow width, stacking, scroll ownership, no overlap/clipping | Screenshot and actual viewport/overflow measurements |
| layout-desktop | Requested wide layout and reference fidelity | Screenshot at the reference dimensions |
| dialog-add | Open -> labeled input -> submit -> item/count changed -> close | Before/after state and interaction receipt |
| keyboard-dialog | Focus enters, Tab cycles, Escape dismisses, focus returns | Observed active element/focus sequence |
| state-error | Intended validation/error/recovery appears, not only happy path | Interaction and resulting state |
| export-html | Actual download opens outside Claude and behaves correctly | File/hash plus independent render and interaction |

Use the task's actual criteria; these are examples, not mandatory features.
Capture light/dark or reduced-motion variants only where the brief or host QA
contract requires them. The matrix must not quietly shrink after a failure.

## Check the rendered surface

1. Confirm the artifact identity, type, edit rights, selected design system and
   page/artboard. Inspect all requested content; placeholders and fake labels are
   failures where real copy was supplied.
2. Look at actual screenshots, not only DOM text. Compare hierarchy, typography,
   spacing, color, geometry, icons/assets and density against the reference.
   Capture only the relevant design, avoiding personal sidebar/chat content.
3. Use real viewport measurements, not a requested window size. Desktop tools
   can enforce a minimum outer width. An artboard zoomed to fit is not a phone
   layout. Verify `innerWidth` in the rendered content or the appropriate frame.
4. Exercise scrolling and long content. Check bottom-of-page controls, sticky
   elements and dialogs, not just the first viewport.
5. Enter **Play** before testing interactions; clicks in the canvas editor can
   select a layer rather than activate a button. Record the actual state change,
   not a successful click response.
6. Test keyboard and labels, focus placement/return, contrast where required,
   and reduced motion where animation exists. A `role="dialog"` attribute alone
   does not prove keyboard accessibility.

Read the active browser API rather than guessing Playwright methods. Re-observe
after navigation or large DOM changes; refs are observation-scoped.
If text entry appears successful but submission does nothing, distinguish a
generated defect from input events not reaching the framework. Re-observe,
try the documented native keyboard/input path, or independently test the export.
Do not report a broken design from an unverified automation failure.

## Export is a separate output

Subscribe to the download event/file completion **before** requesting it.
Use the viewer's actual Export control; keep sharing unchanged. Verify:

- File exists, is nonempty, and matches the requested format rather than a login
  page, temporary download or an error response. Preserve its filename, absolute
  path, size and SHA-256 in the evidence receipt.
- HTML opens outside Claude, without relying on an authenticated editor frame.
  Inspect external resource requirements and whether those match the brief.
  Raw `.dc.html` source with `support.js` is not proven standalone.
- Check both a narrow **CSS viewport** and true **mobile emulation**. In the
  baseline, responsive CSS worked at 390px but both exports omitted
  `<meta name="viewport">`, so mobile browsers used a 980px layout and shrank it.
  Measure actual width and metadata; do not insert a tag merely to make the test
  pass. If local fixes are requested, preserve and label the derivative.
- Exercise interactions independently in exported HTML. Generated code and
  downloads are untrusted; use a task-owned sandbox/browser, no credentials or
  external writes. Test only the behavior the user authorized.
- For PDF/decks, render every page and check clipping, blank pages, order, text,
  images and pagination. For PNG, inspect dimensions, content and actual pixels.
  Format availability differs by artifact type; report unsupported exports.

For Word, require a genuine DOCX and inspect document structure and conversion
fidelity. For PowerPoint, require a genuine editable PPTX, enumerate and render
every slide, and verify requested notes/editability in an appropriate viewer.
Neither a PDF nor renamed HTML satisfies an Office-format request.
For dashboards, bind every numerical/export check to dataset version, metric
definition, filter state and freshness; compare the output to independent
calculations. See the per-type recipes for detailed checklists.

Preserve enough source and reference evidence for engineering handoff. A good
screenshot does not mean a downloaded file works, or that all editable source
files were available.

## Correction loop and completion

For each failed ID, record actual versus expected plus the target selection.
Use the revision template to fix the smallest coherent delta on the same
artifact. Invalidate checks affected by a remote change; recheck the changed
surface and shared consumers. New screenshots and exported files must come
from the final revision, not the earlier successful draft.

The ledger conservatively invalidates all planned checks on a design mutation.
After reassessing unchanged surfaces, they may be recorded again with valid
evidence; do not carry old passes over without checking their inputs. Exports
alone do not invalidate the source design. Bind exported evidence to the
artifact/revision or observed timestamp that produced it.

Mark each ID `pass`, `fail`, or `blocked` with an actual evidence file. The helper
checks presence/hashes, not screenshot quality or honesty. A semantic snapshot,
tool receipt or text log can describe a check, but visual claims require viewed
images. Remote edits by another person can stale local evidence without changing
its bytes: re-observe the remote artifact before completing or resuming.

Continue authorized corrections until the user's finish condition holds. A
missing capability or human-only decision is reported plainly, never hidden by
`complete`, a skipped requirement, or a downgraded deliverable.
