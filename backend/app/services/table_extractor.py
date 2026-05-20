from __future__ import annotations

import re
from pathlib import Path
from collections.abc import Callable
from typing import Any

import camelot
import pandas as pd
import pdfplumber

from app.utils.data_types import clean_cell, dataframe_to_table
from app.utils.logging_config import get_logger
from app.utils.retry import with_retry

logger = get_logger(__name__)


def extract_tables_from_text_pdf(pdf_path: Path, log: Callable[[str], None]) -> list[dict[str, Any]]:
    """Try multiple extraction strategies with fallback chain."""
    tables: list[dict[str, Any]] = []
    strategies_used: list[str] = []

    extractors = [
        ("camelot_lattice", _extract_camelot_lattice),
        ("camelot_stream", _extract_camelot_stream),
        ("pdfplumber_tables", _extract_pdfplumber_tables),
        ("pdfplumber_text", _extract_pdfplumber_text),
    ]

    for name, extractor in extractors:
        try:
            log(f"Trying strategy: {name}")
            found = with_retry(lambda: extractor(pdf_path), label=name, max_retries=2)
            if found:
                log(f"Strategy {name} found {len(found)} table(s)")
                strategies_used.append(name)
                tables.extend(found)
                if len(tables) >= 1 and name in ("camelot_lattice", "camelot_stream", "pdfplumber_tables"):
                    break
        except Exception as exc:  # noqa: BLE001
            log(f"Strategy {name} failed: {exc}")
            logger.warning("Strategy %s failed: %s", name, exc)

    # Deduplicate similar tables (same page + similar row count)
    unique: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for table in tables:
        key = f"{table['page']}:{len(table['rows'])}:{','.join(table['columns'][:3])}"
        if key not in seen_keys and table["rows"]:
            seen_keys.add(key)
            unique.append(table)

    for i, table in enumerate(unique):
        table["name"] = f"Table_{i + 1}_p{table['page']}"

    return unique


def _extract_camelot_lattice(pdf_path: Path) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    result = camelot.read_pdf(str(pdf_path), flavor="lattice", pages="all")
    for i, table in enumerate(result):
        if table.df is not None and not table.df.empty:
            page = int(table.page)
            parsed = dataframe_to_table(
                table.df,
                name=f"camelot_lattice_{i + 1}",
                page=page,
                strategy="camelot_lattice",
            )
            if parsed["rows"]:
                tables.append(parsed)
    return tables


def _extract_camelot_stream(pdf_path: Path) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    result = camelot.read_pdf(str(pdf_path), flavor="stream", pages="all")
    for i, table in enumerate(result):
        if table.df is not None and not table.df.empty:
            page = int(table.page)
            parsed = dataframe_to_table(
                table.df,
                name=f"camelot_stream_{i + 1}",
                page=page,
                strategy="camelot_stream",
            )
            if parsed["rows"]:
                tables.append(parsed)
    return tables


def _extract_pdfplumber_tables(pdf_path: Path) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            page_tables = page.extract_tables() or []
            for i, raw_table in enumerate(page_tables):
                if not raw_table or len(raw_table) < 2:
                    continue
                df = pd.DataFrame(raw_table)
                parsed = dataframe_to_table(
                    df,
                    name=f"pdfplumber_{page_num}_{i + 1}",
                    page=page_num,
                    strategy="pdfplumber_tables",
                )
                if parsed["rows"]:
                    tables.append(parsed)
    return tables


def _extract_pdfplumber_text(pdf_path: Path) -> list[dict[str, Any]]:
    """Fallback: parse text lines into rows when no table structure detected."""
    all_rows: list[list[str]] = []
    page_start = 1

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
            for line in lines:
                row = _parse_text_line(line)
                if row:
                    all_rows.append(row)
            page_start = page_num

    if len(all_rows) < 2:
        return []

    max_cols = max(len(r) for r in all_rows)
    normalized = [r + [""] * (max_cols - len(r)) for r in all_rows]
    columns = [f"Column_{i + 1}" for i in range(max_cols)]

    return [
        {
            "name": "text_fallback",
            "page": page_start,
            "columns": columns,
            "rows": normalized,
            "strategy": "pdfplumber_text",
        }
    ]


def _parse_text_line(line: str) -> list[str] | None:
    if "\t" in line:
        parts = [clean_cell(p) for p in line.split("\t") if clean_cell(p)]
        return parts if len(parts) >= 2 else None

    if ";" in line and line.count(";") >= 2:
        parts = [clean_cell(p) for p in line.split(";")]
        return parts if len(parts) >= 2 else None

    multi_space = re.split(r"\s{2,}", line)
    if len(multi_space) >= 3:
        return [clean_cell(p) for p in multi_space if clean_cell(p)]

    price_match = re.search(r"([\d.,]+)\s*(RSD|EUR|USD|€|\$)?\s*$", line, re.IGNORECASE)
    if price_match:
        name = line[: price_match.start()].strip()
        price = price_match.group(0).strip()
        if name:
            return [name, price]

    return None
