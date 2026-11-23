"""Word document operations through Word's scripting dictionary."""

from __future__ import annotations

import argparse
from pathlib import Path

from ._office import OfficeError, decode, destination, existing, guard, run, text


def _open(file: Path) -> str:
    # Word's `open` returns nothing; the guard above makes the name unique, so take it by name.
    return guard(file, "documents") + f"""            open (POSIX file (item 1 of argv)) add to recent files false
            set ownedDoc to document {text(file.name)}
"""


def word(args: argparse.Namespace) -> dict[str, str | int]:
    action = args.action
    file = destination(args.file, ".docx") if action == "create" else existing(args.file)
    if action == "create":
        if file.exists():
            raise OfficeError(f"file already exists: {file}")
        body = guard(file, "documents") + """            set ownedDoc to make new document
"""
        if args.title:
            # A visible first-line heading (Heading 1), plus the document's Title property.
            body += """            set content of text object of ownedDoc to ((item 3 of argv) & return & (item 2 of argv))
            set style of paragraph 1 of ownedDoc to style heading1
            set style of paragraph 2 of ownedDoc to style normal
            set value of document property "Title" of ownedDoc to (item 3 of argv)
"""
        else:
            body += "            set content of text object of ownedDoc to (item 2 of argv)\n"
        body += """            save as ownedDoc file name (item 1 of argv) file format format document default
            set ownedDoc to document (item 4 of argv)
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "created"
"""
        run("Word", body, str(file), args.text, args.title or "", file.name)
        return {"status": "created", "file": str(file)}
    body = _open(file)
    if action == "read":
        body += """            set answerText to (my b64(content of text object of ownedDoc)) & tab & ((count of paragraphs of text object of ownedDoc) as text)
            close ownedDoc saving no
            set ownedDoc to missing value
"""
        content, count = run("Word", body, str(file))[0].split("\t")
        return {"text": decode(content).replace("\r", "\n").rstrip("\n"), "paragraph_count": int(count)}
    if action == "append":
        body += """            -- Insert at the end: rewriting the whole text would reset every paragraph's formatting.
            insert text (return & (item 2 of argv)) at end of text object of ownedDoc
"""
        arguments = (str(file), args.text)
        status = "appended"
    elif action == "replace":
        if not args.find:
            raise OfficeError("--find must not be empty")
        replacement = "replace all" if args.all else "replace one"
        body += f"""            execute find (find object of text object of ownedDoc) find text (item 2 of argv) replace with (item 3 of argv) replace {replacement} match case true
"""
        arguments = (str(file), args.find, args.replacement)
        status = "replaced"
    else:
        out = destination(args.out, ".pdf")
        body += """            save as ownedDoc file name (item 2 of argv) file format format PDF
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "exported"
"""
        run("Word", body, str(file), str(out))
        return {"status": "exported", "file": str(out)}
    body += f"""            save ownedDoc
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "{status}"
"""
    run("Word", body, *arguments)
    return {"status": status, "file": str(file)}
