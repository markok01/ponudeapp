from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pdfplumber

from app.services.horeca_excel import export_horeca_workbook


def _clean(v: Any) -> str:
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def _is_header(cells: list[str]) -> bool:
    non_empty = [c for c in cells if c]
    if len(non_empty) < 3:
        return False
    lower = " ".join(cells).lower()
    return ("šifra" in lower or "sifra" in lower) and (
        "artikal" in lower or "artiakal" in lower
    )


def _is_brand(cells: list[str]) -> str | None:
    trimmed = [c for c in cells if c]
    if not trimmed or _is_header(cells):
        return None
    first = trimmed[0]
    if re.match(r"^(šifra|sifra|artikal)", first, re.I):
        return None
    if len(trimmed) == 1 and 2 <= len(first) < 80 and not first.isdigit():
        return first
    if len(trimmed) >= 2 and all(c.upper() == first.upper() for c in trimmed) and len(first) > 2:
        return first
    return None


def _parse_price(raw: str) -> float | None:
    if not raw:
        return None
    s = re.sub(r"din/?(kom|kg|seta)?|rsd|eur", "", raw, flags=re.I)
    s = re.sub(r"[^\d,.-]", "", s.replace(" ", ""))
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        s = parts[0].replace(".", "") + "." + parts[1] if len(parts) == 2 else s.replace(",", ".")
    try:
        n = float(s)
        return n if n >= 0 else None
    except ValueError:
        return None


def _is_likely_price(raw: str) -> bool:
    if not raw or re.search(r"tr\.?\s*pak", raw, re.I):
        return False
    n = _parse_price(raw)
    return n is not None and n >= 10


def _is_section_brand(cells: list[str], layout: str) -> str | None:
    cols = 7 if layout == "wide" else 6
    norm = (cells + [""] * cols)[:cols]
    price_col = 5 if layout == "wide" else 4
    sifra, nova = norm[0], norm[1]
    name = norm[2] or norm[3]
    if _is_likely_price(norm[price_col]):
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


def _extract_brand_label(cells: list[str]) -> str:
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


def _brand_cells(label: str, layout: str) -> list[str]:
    cols = 7 if layout == "wide" else 6
    row = [""] * cols
    row[0] = label
    return row


def _classify(cells: list[str], layout: str) -> str:
    cols = 7 if layout == "wide" else 6
    norm = (cells + [""] * cols)[:cols]
    if not any(norm):
        return "raw"
    text = " ".join(norm).lower()
    if ("horeca" in text and "cenovnik" in text) or "cene su iskazane" in text:
        return "title"
    if _is_header(norm):
        return "header"
    if _is_brand(norm):
        return "brand"
    if _is_section_brand(norm, layout):
        return "brand"
    price_col = 5 if layout == "wide" else 4
    if _is_likely_price(norm[price_col]):
        return "product"
    non_empty = [c for c in norm if c]
    if len(non_empty) == 1 and len(non_empty[0]) > 2 and not non_empty[0].isdigit():
        return "brand"
    return "raw"


def _detect_layout(cells: list[str]) -> str:
    lower = " ".join(cells).lower()
    return "wide" if lower.count("artikal") + lower.count("artiakal") >= 2 else "compact"


def _normalize_row(raw: list, layout: str) -> list[str]:
    cols = 7 if layout == "wide" else 6
    cells = [_clean(x) for x in raw]
    while len(cells) < cols:
        cells.append("")
    cells = cells[:cols]
    if layout == "wide" and not cells[3] and cells[2]:
        cells[3] = cells[2]
    return cells


def parse_horeca_pdf(pdf_path: Path, log: Callable[[str], None]) -> list[dict[str, Any]]:
    sheets: list[dict[str, Any]] = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        log(f"HoReCa PDF: {len(pdf.pages)} stranica")
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables() or []
            if not tables:
                continue
            table = max(tables, key=len)
            layout = "compact"
            rows_out: list[dict[str, Any]] = []

            for raw in table:
                cells = [_clean(x) for x in raw]
                if not any(cells):
                    continue
                if _is_header(cells):
                    layout = _detect_layout(cells)
                norm = _normalize_row(raw, layout)
                kind = _classify(norm, layout)
                if kind == "brand":
                    norm = _brand_cells(_extract_brand_label(norm), layout)
                rows_out.append({"kind": kind, "cells": norm, "layout": layout})

            if rows_out:
                sheets.append({"name": f"Table {page_num}", "layout": layout, "rows": rows_out})
                log(f"Stranica {page_num}: {len(rows_out)} redova ({layout})")

    return sheets


def is_horeca_pdf(pdf_path: Path) -> bool:
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            sample = (pdf.pages[0].extract_text() or "").lower() if pdf.pages else ""
            if "horeca" in sample and "cenovnik" in sample:
                return True
            tables = pdf.pages[0].extract_tables() if pdf.pages else []
            if tables:
                header = " ".join(_clean(c) for c in tables[0][0] if c).lower()
                return "šifra" in header or "sifra" in header
    except Exception:
        return False
    return False


def run_horeca_pipeline(job, pdf_path: Path) -> None:
    job.log("HoReCa cenovnik — specijalizovani parser")
    sheets = parse_horeca_pdf(pdf_path, job.log)

    product_count = sum(
        1 for s in sheets for r in s["rows"] if r.get("kind") == "product"
    )
    if product_count < 1:
        raise RuntimeError("HoReCa PDF nema prepoznatih proizvoda")

    job.log(f"Ukupno {product_count} proizvoda sa {len(sheets)} stranica → jedan Excel tab")

    from app.config import settings

    job_dir = settings.temp_dir / job.id
    job_dir.mkdir(parents=True, exist_ok=True)
    output_path = job_dir / f"{job.base_name}.xlsx"

    row_count, sheet_count = export_horeca_workbook(sheets, output_path)
    job.result_path = output_path
    job.file_name = f"{job.base_name}.xlsx"
    job.row_count = row_count
    job.sheet_count = sheet_count
