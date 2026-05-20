from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ExportMode(str, Enum):
    SINGLE_SHEET = "single_sheet"
    MULTIPLE_SHEETS = "multiple_sheets"
    COMBINED = "combined"


class PdfType(str, Enum):
    TEXT = "text"
    SCAN = "scan"
    MIXED = "mixed"


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TablePreview(BaseModel):
    name: str
    page: int
    columns: list[str]
    rows: list[list[str]]
    row_count: int


class ConversionPreview(BaseModel):
    pdf_type: PdfType
    page_count: int
    table_count: int
    tables: list[TablePreview]
    strategies_used: list[str]


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    logs: list[str] = Field(default_factory=list)
    error: str | None = None
    preview: ConversionPreview | None = None
    file_name: str | None = None
    row_count: int | None = None
    sheet_count: int | None = None
    created_at: datetime
    updated_at: datetime


class ConvertResponse(BaseModel):
    job_id: str
    message: str = "Conversion started"


class HealthResponse(BaseModel):
    status: str
    ocr_enabled: bool
    version: str = "1.0.0"


class ExtractedTable(BaseModel):
    name: str
    page: int
    columns: list[str]
    rows: list[list[Any]]
    strategy: str

    model_config = {"arbitrary_types_allowed": True}
