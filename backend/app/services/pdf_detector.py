from __future__ import annotations

from pathlib import Path

import pdfplumber

from app.models.schemas import PdfType
from app.utils.logging_config import get_logger

logger = get_logger(__name__)


def detect_pdf_type(pdf_path: Path) -> tuple[PdfType, int]:
    """Detect whether PDF has selectable text or is primarily scanned."""
    with pdfplumber.open(str(pdf_path)) as pdf:
        page_count = len(pdf.pages)
        if page_count == 0:
            return PdfType.SCAN, 0

        sample_count = min(3, page_count)
        text_chars = 0
        image_heavy_pages = 0

        for page in pdf.pages[:sample_count]:
            text = (page.extract_text() or "").strip()
            text_chars += len(text)
            if len(text) < 20:
                images = page.images or []
                if len(images) >= 1:
                    image_heavy_pages += 1

        if text_chars > 100:
            if image_heavy_pages >= sample_count // 2 + 1:
                return PdfType.MIXED, page_count
            return PdfType.TEXT, page_count

        if text_chars > 30:
            return PdfType.MIXED, page_count

        return PdfType.SCAN, page_count
