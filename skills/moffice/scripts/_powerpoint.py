"""PowerPoint presentation operations through its scripting dictionary."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from ._office import OfficeError, decode, destination, existing, guard, run, text


def _slides(raw: str) -> list[tuple[str, str]]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise OfficeError(f"invalid JSON slides: {error}") from error
    if not isinstance(data, list) or not data:
        raise OfficeError("--slides must be a nonempty list of title/body objects")
    slides: list[tuple[str, str]] = []
    for slide in data:
        if not isinstance(slide, dict) or set(slide) != {"title", "body"}:
            raise OfficeError("--slides must contain only title and body")
        title, body = slide["title"], slide["body"]
        if not isinstance(title, str) or not isinstance(body, str):
            raise OfficeError("slide title and body must be strings")
        slides.append((title, body))
    return slides


def _open(file: Path) -> str:
    # PowerPoint's `open` returns nothing; the guard above makes the name unique, so take it by name.
    return guard(file, "presentations") + f"""            open (POSIX file (item 1 of argv))
            set ownedDoc to presentation {text(file.name)}
"""


def _add_slide(title_position: int, body_position: int) -> str:
    return f"""            set newSlide to make new slide at end of ownedDoc with properties {{layout:slide layout blank}}
            set titleShape to make new text box at end of newSlide with properties {{left position:40, top:35, width:600, height:80}}
            set content of text range of text frame of titleShape to (item {title_position} of argv)
            set bodyShape to make new text box at end of newSlide with properties {{left position:40, top:140, width:600, height:300}}
            set content of text range of text frame of bodyShape to (item {body_position} of argv)
"""


def powerpoint(args: argparse.Namespace) -> dict[str, str | int | list[dict[str, list[str]]]]:
    action = args.action
    file = destination(args.file, ".pptx") if action == "create" else existing(args.file)
    if action == "create":
        if file.exists():
            raise OfficeError(f"file already exists: {file}")
        slides = _slides(args.slides)
        body = """            set ownedDoc to make new presentation
            repeat while (count of slides of ownedDoc) > 0
                delete slide 1 of ownedDoc
            end repeat
"""
        for index in range(len(slides)):
            body += _add_slide(index * 2 + 2, index * 2 + 3)
        # Saving to a new path renames the open presentation, so re-take it by its new name.
        body += f"""            save ownedDoc in (POSIX file (item 1 of argv)) as save as Open XML presentation
            set ownedDoc to presentation {text(file.name)}
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "created"
"""
        arguments = [str(file)]
        for title, content in slides:
            arguments.extend((title, content))
        run("PowerPoint", body, *arguments)
        return {"status": "created", "file": str(file), "count": len(slides)}
    body = _open(file)
    if action == "add-slide":
        body += _add_slide(2, 3)
        body += """            save ownedDoc
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "added"
"""
        run("PowerPoint", body, str(file), args.title, args.body)
        return {"status": "added", "file": str(file)}
    if action == "read":
        body += """            set slideLines to {}
            repeat with slideIndex from 1 to (count of slides of ownedDoc)
                set sl to slide slideIndex of ownedDoc
                set shapeLines to {}
                repeat with shapeIndex from 1 to (count of shapes of sl)
                    set shp to shape shapeIndex of sl
                    if has text frame of shp then
                        if has text of text frame of shp then
                            set end of shapeLines to my b64(content of text range of text frame of shp)
                        end if
                    end if
                end repeat
                set AppleScript's text item delimiters to (character id 9)
                if (count of shapeLines) = 0 then
                    set end of slideLines to "-"
                else
                    set end of slideLines to shapeLines as text
                end if
            end repeat
            set AppleScript's text item delimiters to linefeed
            set answerText to slideLines as text
            close ownedDoc saving no
            set ownedDoc to missing value
"""
        lines = run("PowerPoint", body, str(file))
        slides = [
            {"texts": [] if line == "-" else [decode(part) for part in line.split("\t") if part]}
            for line in lines
        ]
        return {"slides": slides, "count": len(slides)}
    out = destination(args.out, ".pdf")
    body += """            save ownedDoc in (POSIX file (item 2 of argv)) as save as PDF
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "exported"
"""
    run("PowerPoint", body, str(file), str(out))
    return {"status": "exported", "file": str(out)}
