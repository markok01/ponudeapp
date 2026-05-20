from __future__ import annotations

import shutil
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from app.config import settings
from app.models.schemas import ConversionPreview, JobStatus
from app.utils.logging_config import get_logger

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.PENDING
    progress: int = 0
    logs: list[str] = field(default_factory=list)
    error: str | None = None
    preview: ConversionPreview | None = None
    result_path: Path | None = None
    file_name: str | None = None
    row_count: int | None = None
    sheet_count: int | None = None
    pdf_path: Path | None = None
    export_mode: str = "multiple_sheets"
    base_name: str = "document"
    created_at: datetime = field(default_factory=_utcnow)
    updated_at: datetime = field(default_factory=_utcnow)

    def log(self, message: str) -> None:
        self.logs.append(message)
        self.updated_at = _utcnow()
        logger.info("[job %s] %s", self.id[:8], message)

    def set_progress(self, value: int) -> None:
        self.progress = max(0, min(100, value))
        self.updated_at = _utcnow()


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(
        self,
        *,
        pdf_path: Path,
        export_mode: str,
        base_name: str,
    ) -> Job:
        job_id = str(uuid.uuid4())
        job = Job(
            id=job_id,
            pdf_path=pdf_path,
            export_mode=export_mode,
            base_name=base_name,
        )
        with self._lock:
            self._jobs[job_id] = job
        job.log("Job created")
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def delete(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job:
            self._cleanup_job_files(job)

    def cleanup_expired(self) -> None:
        cutoff = _utcnow().timestamp() - settings.job_ttl_seconds
        with self._lock:
            expired = [
                jid
                for jid, job in self._jobs.items()
                if job.updated_at.timestamp() < cutoff
            ]
            for jid in expired:
                job = self._jobs.pop(jid, None)
                if job:
                    self._cleanup_job_files(job)
        if expired:
            logger.info("Cleaned up %s expired jobs", len(expired))

    def _cleanup_job_files(self, job: Job) -> None:
        for path in (job.pdf_path, job.result_path):
            if path and path.exists():
                try:
                    path.unlink()
                except OSError as exc:
                    logger.warning("Failed to delete %s: %s", path, exc)
        job_dir = settings.temp_dir / job.id
        if job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)

    def run_in_background(self, job: Job, worker: Callable[[Job], None]) -> None:
        def _run() -> None:
            try:
                job.status = JobStatus.PROCESSING
                job.set_progress(5)
                worker(job)
                if job.status != JobStatus.FAILED:
                    job.status = JobStatus.COMPLETED
                    job.set_progress(100)
                    job.log("Conversion completed successfully")
            except Exception as exc:  # noqa: BLE001
                job.status = JobStatus.FAILED
                job.error = str(exc)
                job.log(f"Fatal error: {exc}")
                logger.exception("Job %s failed", job.id)

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()


job_manager = JobManager()
