# Domain routes

Pick every row the deliverable spans. For each: read the installed skills named
(check the session's skill list; names differ per host), apply the quality bar,
and add the QA surface to the ledger checks.

When a route names a skill that is not installed, say so and work from the
quality bar. A missing skill can be found with `find-skills`, but installing
it needs the user's yes. The "popular external" column lists skills ranked high
in the best-skills rankings (see [sources.md](sources.md)); it is a pointer for
what to look for, not a claim that they are installed or better.

| Domain | Read when installed | Popular external | Quality bar | QA surface |
| --- | --- | --- | --- | --- |
| Code (any language) | `programming`, `refactor`, `debugging`, `ast-grep` | mattpocock `tdd`, `codebase-design`, `diagnosing-bugs` | public seams tested, smallest change, no dead code, diagnostics clean | tests, CLI/API runs |
| Frontend and UI design | `frontend`, `visual-qa`, `browser` | anthropics `frontend-design`, vercel-labs `web-design-guidelines`, `vercel-react-best-practices` | a deliberate visual direction (not a default template), hierarchy, spacing and type scale consistent, every state designed (empty, loading, error), keyboard and contrast accessible, responsive | screenshots at desktop and mobile widths, interaction run, competing sketches for novel UI |
| Video and motion | `slack-gif-creator`, host video tools | remotion-dev `remotion-best-practices`, `remotion-render`, `remotion-captions`; heygen-com `hyperframes` | brief and storyboard before render, timing matched to the script, readable captions, consistent style, audio levels sane, correct resolution and duration | render, then inspect sampled frames and duration with a real tool (ffprobe or equivalent), watch the risky segments |
| Images and illustration | `gpt-image-gen`, `canvas-design`, `algorithmic-art` | steipete `nano-banana-pro` | prompt states subject, composition, style, text and size; text in images checked letter by letter | open and look at every output at full size |
| Documents and writing | `docs`, `docx`, `pdf`, `karpathy-prompt`, `doc-coauthoring` | pstack `technical-writing`, `unslop` | one purpose per document, reader's terms, claims sourced, no filler | render or export and read the final layout |
| Slides and spreadsheets | `pptx`, `xlsx` | none recorded | one message per slide, numbers traceable to source cells | render slides to images and look; recalc and spot-check formulas |
| Research and analysis | `ulw-research`, `deep-research`, `data-scientist` | gajae-code `autoresearch` | primary sources, every claim cited, a verdict with caveats | citations open and say the sentence; analysis reruns |
| Performance and cost | `ci-test-rebuild` | pstack `benchmark-checklist` | decision named before measuring, noise floor, limiter identified | before/after on the same workload and machine |
| Agent skills and prompts | `create-skills`, `karpathy-prompt` | mattpocock `writing-for-agents` | trigger and boundary clear, procedure testable, no unverifiable claims | the repo's skill contract checks |
| Mac and app automation | `opencua` (formerly apple-cua; user's standing choice), `moffice`, `apple-suite` | none recorded | the target app named explicitly, irreversible steps confirmed | observe the app state after each action |
| Release and product | `dft`, `preflight`, `finish-pr`, `review-work` | gajae-code ralplan critic | shipped entry points work for a new user | dogfood journey log |

Quality bars and QA surfaces above are this skill's own; they do not quote the
external skills. When an installed domain skill states a stricter bar, follow it.
