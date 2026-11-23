# Office AppleScript notes

- Word opens a `POSIX file` alias; Excel's `open workbook workbook file name`
  and `save workbook as ... filename` take path **text**. PowerPoint uses
  `POSIX file` with the standard `open`/`save ... in ... as` commands.
  `full name` of a Word document uses HFS path syntax; do not compare it
  directly to a POSIX path.
- Save-format constants differ: Word `format document default` / `format PDF`;
  Excel `Excel XML file format` / `PDF file format`; PowerPoint
  `save as Open XML presentation` / `save as PDF`.
- Office apps are sandboxed. Supplying a `POSIX file` does not bypass their
  access checks: first access to a folder can open **Grant File Access** and
  block an automation call. If this occurs, the human must grant access for
  that folder. Never dismiss or approve unseen dialogs with System Events.
- Verified against Office 16.112 (2026-09-26); each of these broke a live run:
  - Word's and PowerPoint's `open` return nothing. Reference the document by
    name afterwards (`document "x.docx"`, `presentation "x.pptx"`); the
    already-open guard is what makes the name unique.
  - Excel `save workbook as` and PowerPoint `save ... in` to a new path rename
    the open document, so a reference taken before the save stops resolving
    (-1728). Re-take it by the saved file name before closing.
  - Excel's `open workbook workbook file name` wants a POSIX path string; an
    HFS string is a -50 parameter error.
  - Iterating object references (`repeat with sh in worksheets of wb`, `rows
    of range`, `repeat with sl in slides of p`) fails with -50/-1728. Fetch
    plain values in one call (`name of every worksheet`, `value of range`) or
    loop by index (`slide i of p`, `shape j of sl`).
  - Inside `tell application "Microsoft Excel"`/`"Microsoft PowerPoint"`,
    `tab` resolves to an app term, not a tab character; use `character id 9`.
    `out` is a PowerPoint term too, so avoid it as a variable name.
  - `make new slide at end of <presentation>` and `make new text box at end
    of <slide>` work; `at end of slides of ...` / `at end of shapes of ...` do not.
  - Word `execute find` is case-insensitive and case-adapting unless
    `match case true` is passed.
- Automation consent is separate from Office file access. If a file operation
  stalls, inspect the visible app before retrying; do not start another
  conflicting script against the same app.
