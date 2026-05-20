from __future__ import annotations

import re
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import settings
from app.models.schemas import ConvertResponse, ExportMode, HealthResponse, JobResponse, JobStatus
from app.services.job_manager import job_manager
from app.services.parser_pipeline import run_conversion_pipeline

router = APIRouter(prefix="/api/v1")


def _verify_api_key(x_api_key: str | None) -> None:
    if settings.api_key and x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _job_to_response(job) -> JobResponse:
    return JobResponse(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        logs=job.logs[-100:],
        error=job.error,
        preview=job.preview,
        file_name=job.file_name,
        row_count=job.row_count,
        sheet_count=job.sheet_count,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    job_manager.cleanup_expired()
    return HealthResponse(status="ok", ocr_enabled=settings.ocr_enabled)


@router.post("/convert", response_model=ConvertResponse)
async def convert_pdf(
    file: UploadFile = File(...),
    export_mode: ExportMode = Form(ExportMode.MULTIPLE_SHEETS),
    base_name: str = Form("document"),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> ConvertResponse:
    _verify_api_key(x_api_key)

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Samo PDF fajlovi su podržani")

    content = await file.read()
    if len(content) > settings.max_pdf_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"PDF prevelik (max {settings.max_pdf_size_mb} MB)",
        )

    safe_name = re.sub(r"[^\w\-]+", "_", Path(base_name).stem) or "document"
    job_dir = settings.temp_dir / "uploads"
    job_dir.mkdir(parents=True, exist_ok=True)

    # Create job first to get ID for temp path
    temp_pdf = job_dir / f"pending_{safe_name}.pdf"
    temp_pdf.write_bytes(content)

    job = job_manager.create(
        pdf_path=temp_pdf,
        export_mode=export_mode.value,
        base_name=safe_name,
    )

    # Move to job-specific path
    job_pdf = settings.temp_dir / job.id / "source.pdf"
    job_pdf.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(temp_pdf), str(job_pdf))
    job.pdf_path = job_pdf

    job_manager.run_in_background(job, run_conversion_pipeline)

    return ConvertResponse(job_id=job.id, message="Konverzija je pokrenuta")


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> JobResponse:
    _verify_api_key(x_api_key)
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job nije pronađen")
    return _job_to_response(job)


@router.get("/jobs/{job_id}/download")
async def download_job(
    job_id: str,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    _verify_api_key(x_api_key)
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job nije pronađen")
    if job.status != JobStatus.COMPLETED or not job.result_path or not job.result_path.exists():
        raise HTTPException(status_code=400, detail="Excel još nije spreman za preuzimanje")

    return FileResponse(
        path=job.result_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=job.file_name or "document.xlsx",
    )


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    _verify_api_key(x_api_key)
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job nije pronađen")
    job_manager.delete(job_id)
    return {"ok": True}
