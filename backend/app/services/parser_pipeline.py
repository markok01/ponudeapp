from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import settings
from app.models.schemas import ConversionPreview, ExportMode, PdfType, TablePreview
from app.services.excel_generator import generate_excel
from app.services.horeca_parser import is_horeca_pdf, run_horeca_pipeline
from app.services.job_manager import Job
from app.services.ocr_extractor import extract_mixed_pdf, extract_tables_from_scan
from app.services.pdf_detector import detect_pdf_type
from app.services.table_extractor import extract_tables_from_text_pdf
from app.utils.logging_config import get_logger

logger = get_logger(__name__)


def run_conversion_pipeline(job: Job) -> None:
    if not job.pdf_path or not job.pdf_path.exists():
        raise FileNotFoundError("PDF fajl nije pronađen")

    job.set_progress(10)
    job.log("Analyzing PDF document...")

    if is_horeca_pdf(job.pdf_path) or "horeca" in job.base_name.lower() or "cenovnik" in job.base_name.lower():
        run_horeca_pipeline(job, job.pdf_path)
        job.set_progress(100)
        return

    pdf_type, page_count = detect_pdf_type(job.pdf_path)
    job.log(f"Detected PDF type: {pdf_type.value} ({page_count} pages)")
    job.set_progress(20)

    strategies_used: list[str] = []
    tables: list[dict[str, Any]] = []

    if pdf_type == PdfType.TEXT:
        job.log("Extracting tables from text-based PDF...")
        tables = extract_tables_from_text_pdf(job.pdf_path, job.log)
        strategies_used = list({t.get("strategy", "unknown") for t in tables})
    elif pdf_type == PdfType.SCAN:
        job.log("Scanned PDF detected — running OCR pipeline...")
        job.set_progress(40)
        tables = extract_tables_from_scan(job.pdf_path, job.log)
        strategies_used = ["paddleocr"]
    else:
        job.log("Mixed PDF — combining text extraction and OCR...")
        job.set_progress(35)
        tables = extract_mixed_pdf(job.pdf_path, job.log)
        strategies_used = list({t.get("strategy", "unknown") for t in tables})

    job.set_progress(70)

    if not tables:
        raise RuntimeError(
            "Nije pronađena nijedna tabela u PDF-u. "
            "Proverite da li dokument sadrži tabele ili selektabilan tekst."
        )

    total_rows = sum(len(t.get("rows", [])) for t in tables)
    job.log(f"Extracted {len(tables)} table(s), {total_rows} row(s) total")

    preview = _build_preview(pdf_type, page_count, tables, strategies_used)
    job.preview = preview
    job.set_progress(85)

    export_mode = ExportMode(job.export_mode)
    job.log(f"Generating Excel ({export_mode.value})...")

    job_dir = settings.temp_dir / job.id
    job_dir.mkdir(parents=True, exist_ok=True)
    output_path = job_dir / f"{job.base_name}.xlsx"

    row_count, sheet_count = generate_excel(
        tables,
        output_path,
        export_mode=export_mode,
        base_name=job.base_name,
    )

    job.result_path = output_path
    job.file_name = f"{job.base_name}.xlsx"
    job.row_count = row_count
    job.sheet_count = sheet_count
    job.set_progress(95)
    job.log(f"Excel ready: {sheet_count} sheet(s), {row_count} row(s)")


def _build_preview(
    pdf_type: PdfType,
    page_count: int,
    tables: list[dict[str, Any]],
    strategies: list[str],
) -> ConversionPreview:
    previews: list[TablePreview] = []
    for table in tables[:10]:
        rows = table.get("rows", [])[:20]
        previews.append(
            TablePreview(
                name=table.get("name", "Table"),
                page=table.get("page", 1),
                columns=table.get("columns", []),
                rows=[[str(c) for c in row] for row in rows],
                row_count=len(table.get("rows", [])),
            )
        )

    return ConversionPreview(
        pdf_type=pdf_type,
        page_count=page_count,
        table_count=len(tables),
        tables=previews,
        strategies_used=strategies,
    )
