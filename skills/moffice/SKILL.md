---
name: moffice
description: "Drive Word, Excel, and PowerPoint via AppleScript: read, edit, create, export PDF. Use for Office files on this Mac. Not for Notes (apple-suite)."
version: 1.1.2
license: MIT
when_to_use: "Use for explicit Microsoft Office document tasks on macOS. Writes, replacements, exports, and new documents require a user request; do not alter other open documents."
metadata:
  agentskills:
    tags: [macos, microsoft, office, word, excel, powerpoint, applescript, documents]
---

# Microsoft Office

Run `python3 scripts/moffice.py` from this skill's directory (or with its
absolute path). Append `--json` anywhere on the command line to receive JSON on
success. Exit-1 errors always print `{"error": "..."}` on stdout; exit-2 errors
print plain `error: ...` text on stderr.

## Commands

```bash
python3 scripts/moffice.py apps --json
python3 scripts/moffice.py excel sheets FILE.xlsx
python3 scripts/moffice.py excel read FILE.xlsx [--sheet Sheet1] [--range A1:C10]
python3 scripts/moffice.py excel write FILE.xlsx --sheet Sheet1 --range A1 --values '[["a",1],["b",2]]'
python3 scripts/moffice.py excel new FILE.xlsx
python3 scripts/moffice.py excel export-pdf FILE.xlsx OUT.pdf
python3 scripts/moffice.py word read FILE.docx
python3 scripts/moffice.py word create FILE.docx --text "Hello" [--title "Heading"]
python3 scripts/moffice.py word append FILE.docx --text "More"
python3 scripts/moffice.py word replace FILE.docx --find "old" --with "new" [--all]
python3 scripts/moffice.py word export-pdf FILE.docx OUT.pdf
python3 scripts/moffice.py powerpoint read FILE.pptx
python3 scripts/moffice.py powerpoint create FILE.pptx --slides '[{"title":"One","body":"Details"}]'
python3 scripts/moffice.py powerpoint add-slide FILE.pptx --title "Two" --body "More"
python3 scripts/moffice.py powerpoint export-pdf FILE.pptx OUT.pdf
```

Excel `read` defaults to the used range and returns a 2D `values` array plus
the actual sheet name; numbers come back as floats (`1` reads as `1.0`) and
empty cells as `null`. Word `read` returns the text with `\n` between
paragraphs; `replace` is exact and case-sensitive.
`write` starts at the specified cell and creates a missing workbook; the
`--values` argument is a rectangular JSON array of strings, finite numbers,
booleans, or null. PowerPoint `read` returns the text of every text-bearing
shape on each slide, in shape order.

## Boundaries and exit codes

- macOS only. The helper uses `/usr/bin/osascript`, Python's standard library,
  and the Office AppleScript dictionaries; no Office file-format packages or
  Accessibility keystrokes are needed.
- Each file operation refuses a document with the same name already open in
  its app; this is deliberately conservative when files in different folders
  share a name. It closes only the document it opened, without prompting.
  An app already running is never quit; one launched by the helper is quit.
- The requested source must exist except for `excel new`, `excel write`, and
  `word`/`powerpoint create`. New documents must not overwrite existing files.
  Keep copies of important files before using editing commands.
- Office never touches your folders directly: each command copies the file into
  a private folder inside Office's shared container
  (`~/Library/Group Containers/UBF8T346G9.Office/omo-moffice/`), works on the
  copy, and only after success replaces or creates the real file with one
  rename. That container needs no sandbox **Grant File Access** prompt, so the
  prompt does not appear for files anywhere on disk. The private folder is
  always removed, also after a failure; a failed edit leaves the original as it was.
- macOS can still ask once for Automation permission. A denial (`-1743`) is
  reported as denied; a call that does not answer within 30 seconds (`-1712` or a
  hang) is reported as "did not respond", and an app the helper launched is
  asked to quit. If it cannot quit (a dialog is open), the error says so.
  Resolve Automation under System Settings > Privacy & Security > Automation >
  your terminal app > Microsoft Office app. This skill never clicks a dialog;
  the person resolves it. See [Office AppleScript notes](references/applescript.md).
- For clicks, typing, or window control this helper does not cover, use the
  `opencua` skill (OpenCUA, formerly apple-cua; CLI `opencua`). Never write an ad-hoc input script or use
  OmO's native computer-use.
- `word create --title` puts the title as a visible Heading 1 first line (and
  sets the document's Title property). `word append` inserts a new paragraph at
  the end, so existing formatting is kept.
- Exit `0`: success. Exit `1`: document, input-data, or Office-level failure,
  with a JSON `error` on stdout even without `--json`. Exit `2`: invalid
  command/options, unsupported platform, or missing Office app (stderr text).
- Done when the command exits `0`; report the returned result.
