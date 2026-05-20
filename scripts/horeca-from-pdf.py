#!/usr/bin/env python3
"""HoReCa PDF → JSON sheet rows (pdfplumber). Poziva se iz Next.js."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pdfplumber


def clean(v) -> str:
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def is_header(cells: list[str]) -> bool:
    non_empty = [c for c in cells if c]
    if len(non_empty) < 3:
        return False
    lower = " ".join(cells).lower()
    return ("šifra" in lower or "sifra" in lower) and (
        "artikal" in lower or "artiakal" in lower
    )


def is_brand(cells: list[str]) -> str | None:
    trimmed = [c for c in cells if c]
    if not trimmed or is_header(cells):
        return None
    first = trimmed[0]
    if re.match(r"^(šifra|sifra|artikal)", first, re.I):
        return None
    if len(trimmed) == 1 and 2 <= len(first) < 80 and not first.isdigit():
        if " " not in first or first.isupper():
            return first
    if len(trimmed) >= 2 and all(c.upper() == first.upper() for c in trimmed) and len(first) > 2:
        return first
    return None


def parse_price_hint(raw: str) -> float | None:
    if not raw:
        return None
    s = re.sub(r"din/?(kom|kg|seta)?|rsd|eur", "", raw, flags=re.I)
    s = re.sub(r"[^\d,.-]", "", s.replace(" ", ""))
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        s = parts[0].replace(".", "") + "." + parts[1] if len(parts) == 2 else s.replace(",", ".")
    try:
        n = float(s)
        return n if n >= 0 else None
    except ValueError:
        return None


def is_likely_price(raw: str) -> bool:
    if not raw or re.search(r"tr\.?\s*pak", raw, re.I):
        return False
    n = parse_price_hint(raw)
    return n is not None and n >= 10


def is_section_brand(cells: list[str], layout: str) -> str | None:
    cols = 7 if layout == "wide" else 6
    norm = (cells + [""] * cols)[:cols]
    price_col = 5 if layout == "wide" else 4
    sifra, nova = norm[0], norm[1]
    name = norm[2] or norm[3]
    price_raw = norm[price_col]

    if is_likely_price(price_raw):
        return None
    if re.match(r"^\d{3,}$", sifra) or re.match(r"^\d{4,}$", nova):
        return None
    if not name or len(name) < 2:
        return None
    if re.match(r"^(šifra|sifra|artikal|artiakal|p\.?\s*c|pdv|tr\.pak)", name, re.I):
        return None

    c3 = norm[3]
    if c3 and c3.upper() == name.upper():
        return name
    if not sifra and not nova:
        return name
    return None


def extract_brand_label(cells: list[str]) -> str:
    non_empty = [c for c in cells if c]
    if not non_empty:
        return ""
    first = non_empty[0]
    if all(c.upper() == first.upper() for c in non_empty):
        return first
    name = (cells[2] if len(cells) > 2 else "") or (cells[3] if len(cells) > 3 else "")
    if name and not cells[0] and not (cells[1] if len(cells) > 1 else ""):
        return name
    return first


def brand_cells(label: str, layout: str) -> list[str]:
    cols = 7 if layout == "wide" else 6
    row = [""] * cols
    row[0] = label
    return row


def classify(cells: list[str], layout: str) -> str:
    cols = 7 if layout == "wide" else 6
    norm = (cells + [""] * cols)[:cols]
    if not any(norm):
        return "raw"
    text = " ".join(norm).lower()
    if ("horeca" in text and "cenovnik" in text) or "cene su iskazane" in text:
        return "title"
    if is_header(norm):
        return "header"
    if is_brand(norm):
        return "brand"
    section = is_section_brand(norm, layout)
    if section:
        return "brand"
    price_col = 5 if layout == "wide" else 4
    if is_likely_price(norm[price_col]):
        return "product"
    non_empty = [c for c in norm if c]
    if len(non_empty) == 1 and len(non_empty[0]) > 2 and not non_empty[0].isdigit():
        return "brand"
    return "raw"


def detect_layout(cells: list[str]) -> str:
    lower = " ".join(cells).lower()
    if lower.count("artikal") + lower.count("artiakal") >= 2:
        return "wide"
    return "compact"


def normalize_table_row(raw: list, layout: str) -> list[str]:
    cols = 7 if layout == "wide" else 6
    cells = [clean(x) for x in raw]
    while len(cells) < cols:
        cells.append("")
    cells = cells[:cols]
    if layout == "wide" and cells[2] and not cells[3]:
        cells[3] = cells[2]
    return cells


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: horeca-from-pdf.py <file.pdf>"}))
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    sheets = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables() or []
            if not tables:
                continue
            table = max(tables, key=len)
            layout = "compact"
            rows_out = []

            for raw in table:
                cells = [clean(x) for x in raw]
                if not any(cells):
                    continue
                if is_header(cells):
                    layout = detect_layout(cells)
                norm = normalize_table_row(raw, layout)
                kind = classify(norm, layout)
                if kind == "brand":
                    norm = brand_cells(extract_brand_label(norm), layout)
                rows_out.append({"kind": kind, "cells": norm, "layout": layout})

            if rows_out:
                sheets.append(
                    {
                        "name": f"Table {page_num}",
                        "layout": layout,
                        "rows": rows_out,
                    }
                )

    product_count = sum(
        1 for s in sheets for r in s["rows"] if r["kind"] == "product"
    )
    print(
        json.dumps(
            {
                "sheets": sheets,
                "productCount": product_count,
                "sheetCount": len(sheets),
            }
        )
    )


if __name__ == "__main__":
    main()
