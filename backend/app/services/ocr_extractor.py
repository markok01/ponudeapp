from __future__ import annotations

import re
from pathlib import Path
from collections.abc import Callable
from typing import Any

import pdfplumber

from app.config import settings
from app.utils.data_types import clean_cell
from app.utils.logging_config import get_logger

logger = get_logger(__name__)

_ocr_engine = None


def _get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR

        _ocr_engine = PaddleOCR(use_angle_cls=True, lang=settings.ocr_lang, show_log=False)
    return _ocr_engine


def extract_tables_from_scan(pdf_path: Path, log: Callable[[str], None]) -> list[dict[str, Any]]:
    if not settings.ocr_enabled:
        raise RuntimeError(
            "PDF izgleda skeniran (nema selektabilnog teksta). "
            "Omogućite OCR (OCR_ENABLED=true) ili koristite PDF sa tekstom."
        )

    log("Converting PDF pages to images for OCR...")
    try:
        from pdf2image import convert_from_path
    except ImportError as exc:
        raise RuntimeError("pdf2image nije instaliran. Potreban je poppler.") from exc

    images = convert_from_path(str(pdf_path), dpi=200)
    log(f"OCR processing {len(images)} page(s)...")

    ocr = _get_ocr_engine()
    tables: list[dict[str, Any]] = []

    for page_num, image in enumerate(images, start=1):
        log(f"OCR page {page_num}/{len(images)}")
        result = ocr.ocr(image, cls=True)
        lines: list[list[str]] = []

        if result and result[0]:
            for line_info in result[0]:
                text = clean_cell(line_info[1][0])
                if not text:
                    continue
                row = _parse_ocr_line(text)
                if row:
                    lines.append(row)
                else:
                    lines.append([text])

        if len(lines) >= 2:
            max_cols = max(len(r) for r in lines)
            normalized = [r + [""] * (max_cols - len(r)) for r in lines]
            columns = [f"Column_{i + 1}" for i in range(max_cols)]
            tables.append(
                {
                    "name": f"OCR_Page_{page_num}",
                    "page": page_num,
                    "columns": columns,
                    "rows": normalized,
                    "strategy": "paddleocr",
                }
            )

    if not tables:
        raise RuntimeError("OCR nije uspeo da prepozna tabele u skeniranom PDF-u.")

    return tables


def _parse_ocr_line(text: str) -> list[str] | None:
    if "|" in text:
        parts = [clean_cell(p) for p in text.split("|") if clean_cell(p)]
        return parts if len(parts) >= 2 else None

    multi_space = re.split(r"\s{2,}", text)
    if len(multi_space) >= 2:
        return [clean_cell(p) for p in multi_space if clean_cell(p)]

    tab_parts = text.split("\t")
    if len(tab_parts) >= 2:
        return [clean_cell(p) for p in tab_parts if clean_cell(p)]

    return None


def extract_mixed_pdf(pdf_path: Path, log: Callable[[str], None]) -> list[dict[str, Any]]:
    """For mixed PDFs: try table extraction first, OCR pages with little text."""
    from app.services.table_extractor import extract_tables_from_text_pdf

    tables = extract_tables_from_text_pdf(pdf_path, log)

    with pdfplumber.open(str(pdf_path)) as pdf:
        sparse_pages = []
        for page_num, page in enumerate(pdf.pages, start=1):
            text_len = len((page.extract_text() or "").strip())
            if text_len < 30:
                sparse_pages.append(page_num)

    if sparse_pages and settings.ocr_enabled:
        log(f"Mixed PDF: OCR fallback for {len(sparse_pages)} sparse page(s)")
        try:
            from pdf2image import convert_from_path

            ocr = _get_ocr_engine()
            for page_num in sparse_pages:
                images = convert_from_path(str(pdf_path), first_page=page_num, last_page=page_num, dpi=200)
                if not images:
                    continue
                result = ocr.ocr(images[0], cls=True)
                lines: list[list[str]] = []
                if result and result[0]:
                    for line_info in result[0]:
                        text = clean_cell(line_info[1][0])
                        if text:
                            row = _parse_ocr_line(text)
                            lines.append(row if row else [text])
                if len(lines) >= 2:
                    max_cols = max(len(r) for r in lines)
                    normalized = [r + [""] * (max_cols - len(r)) for r in lines]
                    tables.append(
                        {
                            "name": f"OCR_Page_{page_num}",
                            "page": page_num,
                            "columns": [f"Column_{i + 1}" for i in range(max_cols)],
                            "rows": normalized,
                            "strategy": "paddleocr_mixed",
                        }
                    )
        except Exception as exc:  # noqa: BLE001
            log(f"Mixed OCR fallback skipped: {exc}")

    return tables
