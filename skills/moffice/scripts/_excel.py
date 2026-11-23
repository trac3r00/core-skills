"""Excel workbook operations through Excel's scripting dictionary."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

from ._office import OfficeError, decode, destination, existing, guard, run, text


def _values(raw: str) -> list[list[str | int | float | bool | None]]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise OfficeError(f"invalid JSON values: {error}") from error
    if not isinstance(data, list) or not data or not isinstance(data[0], list) or not data[0]:
        raise OfficeError("--values must be a nonempty rectangular JSON 2D array")
    width = len(data[0])
    for row in data:
        if not isinstance(row, list) or len(row) != width:
            raise OfficeError("--values must be a nonempty rectangular JSON 2D array")
        for cell in row:
            if cell is not None and not isinstance(cell, (str, int, float, bool)):
                raise OfficeError("--values cells must be strings, numbers, booleans or null")
            if isinstance(cell, float) and not math.isfinite(cell):
                raise OfficeError("--values numbers must be finite")
    return data


def _literal(value: str | float | bool | None) -> str:
    if value is None:
        return '""'
    if isinstance(value, str):
        return text(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _open(file: Path) -> str:
    return guard(file, "workbooks") + f"""            open workbook workbook file name (item 1 of argv) update links do not update links read only false
            set ownedDoc to workbook {text(file.name)}
"""


def _require_sheet(sheet: str) -> str:
    return f"""            if (get name of every worksheet of ownedDoc) does not contain {text(sheet)} then error {text(f"sheet not found: {sheet}")}
"""


def excel(args: argparse.Namespace) -> dict[str, str | int | list[str] | list[list[str | float | bool | None]]]:
    action = args.action
    file = destination(args.file, ".xlsx") if action in ("new", "write") else existing(args.file)
    if action == "new" and file.exists():
        raise OfficeError(f"file already exists: {file}")
    if action == "write":
        values = _values(args.values)
        if not re.fullmatch(r"[A-Za-z]{1,3}[1-9][0-9]*", args.range):
            raise OfficeError("--range must be a single starting cell such as A1")
        if not args.sheet:
            raise OfficeError("--sheet must not be empty")
        top = re.fullmatch(r"([A-Za-z]{1,3})([1-9][0-9]*)", args.range)
        assert top is not None
        column = 0
        for letter in top.group(1).upper():
            column = column * 26 + ord(letter) - 64
        row = int(top.group(2))
        if file.exists():
            body = _open(file)
        else:
            body = """            set ownedDoc to make new workbook
            set name of worksheet 1 of ownedDoc to (item 2 of argv)
"""
        cells = "\n".join(
            f'            set value of cell {row + y} of column {column + x} of worksheet {text(args.sheet)} of ownedDoc to {_literal(value)}'
            for y, line in enumerate(values)
            for x, value in enumerate(line)
        )
        if file.exists():
            body += _require_sheet(args.sheet)
            save = "            save ownedDoc\n"
        else:
            save = f"""            save workbook as ownedDoc filename (item 1 of argv) file format Excel XML file format
            set ownedDoc to workbook {text(file.name)}
"""
        body += f"""{cells}
{save}            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "written"
"""
        run("Excel", body, str(file), args.sheet)
        return {"status": "written", "file": str(file), "sheet": args.sheet, "range": args.range}
    if action == "new":
        # `save workbook as` renames the open workbook, so the pre-save reference no longer resolves.
        body = f"""            set ownedDoc to make new workbook
            save workbook as ownedDoc filename (item 1 of argv) file format Excel XML file format
            set ownedDoc to workbook {text(file.name)}
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "created"
"""
        run("Excel", body, str(file))
        return {"status": "created", "file": str(file)}
    body = _open(file)
    if action == "sheets":
        body += """            set sheetNames to {}
            repeat with sheetName in (get name of every worksheet of ownedDoc)
                set end of sheetNames to my b64(sheetName as text)
            end repeat
            set AppleScript's text item delimiters to linefeed
            set answerText to sheetNames as text
"""
        output = run("Excel", body + "            close ownedDoc saving no\n            set ownedDoc to missing value\n", str(file))
        sheets = [decode(item) for item in output]
        return {"sheets": sheets, "count": len(sheets)}
    if action == "read":
        if args.sheet:
            body += _require_sheet(args.sheet) + f"            set sh to worksheet {text(args.sheet)} of ownedDoc\n"
        else:
            body += "            set sh to worksheet 1 of ownedDoc\n"
        if args.range:
            if not re.fullmatch(r"[A-Za-z]{1,3}[1-9][0-9]*(?::[A-Za-z]{1,3}[1-9][0-9]*)?", args.range):
                raise OfficeError("--range must be an A1 range such as A1:C10")
            body += f"            set cellsToRead to range {text(args.range.upper())} of sh\n"
        else:
            body += "            set cellsToRead to used range of sh\n"
        # Excel rejects iterating `rows`/`cells` references, so fetch the value grid in one call
        # and walk the plain AppleScript lists (a single cell comes back as a bare value).
        body += """            set grid to value of cellsToRead
            if class of grid is not list then set grid to {{grid}}
            set resultRows to {my b64(name of sh)}
            repeat with gridRow in grid
                set rowValues to contents of gridRow
                if class of rowValues is not list then set rowValues to {rowValues}
                set rowCells to {}
                repeat with cellValue in rowValues
                    set v to contents of cellValue
                    if v is missing value or v is "" then
                        set end of rowCells to "Z"
                    else if class of v is boolean then
                        set end of rowCells to "B" & (v as text)
                    else if class of v is integer or class of v is real then
                        set end of rowCells to "N" & (v as text)
                    else
                        set end of rowCells to "S" & my b64(v as text)
                    end if
                end repeat
                set AppleScript's text item delimiters to (character id 9)
                set end of resultRows to rowCells as text
            end repeat
            set AppleScript's text item delimiters to linefeed
            set answerText to resultRows as text
            close ownedDoc saving no
            set ownedDoc to missing value
"""
        sheet_line, *lines = run("Excel", body, str(file))
        rows = []
        for line in lines:
            row_values = []
            for cell in line.split("\t"):
                if cell == "Z":
                    row_values.append(None)
                elif cell.startswith("B"):
                    row_values.append(cell == "Btrue")
                elif cell.startswith("N"):
                    row_values.append(float(cell[1:]))
                else:
                    row_values.append(decode(cell[1:]))
            rows.append(row_values)
        return {"values": rows, "sheet": decode(sheet_line)}
    out = destination(args.out, ".pdf")
    body += """            save workbook as ownedDoc filename (item 2 of argv) file format PDF file format
            close ownedDoc saving no
            set ownedDoc to missing value
            set answerText to "exported"
"""
    run("Excel", body, str(file), str(out))
    return {"status": "exported", "file": str(out)}
