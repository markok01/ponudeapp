export type ExportMode = "single_sheet" | "multiple_sheets" | "combined";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type PdfType = "text" | "scan" | "mixed";

export interface TablePreview {
  name: string;
  page: number;
  columns: string[];
  rows: string[][];
  rowCount: number;
}

export interface ConversionPreview {
  pdfType: PdfType;
  pageCount: number;
  tableCount: number;
  tables: TablePreview[];
  strategiesUsed: string[];
}

export interface PdfConvertJob {
  jobId: string;
  status: JobStatus;
  progress: number;
  logs: string[];
  error?: string | null;
  preview?: ConversionPreview | null;
  fileName?: string | null;
  rowCount?: number | null;
  sheetCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConvertStartResponse {
  jobId: string;
  message: string;
}

export interface PdfConverterHealth {
  status: string;
  ocrEnabled: boolean;
  version: string;
}
