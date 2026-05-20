import type {
  ConvertStartResponse,
  ExportMode,
  PdfConvertJob,
  PdfConverterHealth,
  PdfType,
} from "@/types/pdf-converter";

function formatApiError(data: Record<string, unknown>): string | undefined {
  const detail = data.detail ?? data.error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: string }).msg) : String(d)))
      .join("; ");
  }
  return undefined;
}

function getConverterConfig() {
  const baseUrl = process.env.PDF_CONVERTER_URL ?? "http://localhost:8000";
  const apiKey = process.env.PDF_CONVERTER_API_KEY ?? "";
  const timeoutMs = Number(process.env.PDF_CONVERTER_TIMEOUT_MS ?? "300000");

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, timeoutMs };
}

function headers(apiKey: string): HeadersInit {
  const h: Record<string, string> = {};
  if (apiKey) h["X-API-Key"] = apiKey;
  return h;
}

function mapJob(raw: Record<string, unknown>): PdfConvertJob {
  const preview = raw.preview as Record<string, unknown> | null | undefined;
  return {
    jobId: String(raw.job_id ?? raw.jobId),
    status: raw.status as PdfConvertJob["status"],
    progress: Number(raw.progress ?? 0),
    logs: (raw.logs as string[]) ?? [],
    error: (raw.error as string | null) ?? null,
    preview: preview
      ? {
          pdfType: (preview.pdf_type ?? preview.pdfType ?? "text") as PdfType,
          pageCount: Number(preview.page_count ?? preview.pageCount ?? 0),
          tableCount: Number(preview.table_count ?? preview.tableCount ?? 0),
          strategiesUsed: (preview.strategies_used ?? preview.strategiesUsed ?? []) as string[],
          tables: ((preview.tables as Record<string, unknown>[]) ?? []).map((t) => ({
            name: String(t.name),
            page: Number(t.page),
            columns: (t.columns as string[]) ?? [],
            rows: (t.rows as string[][]) ?? [],
            rowCount: Number(t.row_count ?? t.rowCount ?? 0),
          })),
        }
      : null,
    fileName: (raw.file_name ?? raw.fileName) as string | null,
    rowCount: raw.row_count != null ? Number(raw.row_count) : raw.rowCount != null ? Number(raw.rowCount) : null,
    sheetCount: raw.sheet_count != null ? Number(raw.sheet_count) : raw.sheetCount != null ? Number(raw.sheetCount) : null,
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ""),
  };
}

export class PdfConverterError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PdfConverterError";
    this.status = status;
  }
}

export async function checkPdfConverterHealth(): Promise<PdfConverterHealth | null> {
  const { baseUrl, apiKey, timeoutMs } = getConverterConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));

  try {
    const res = await fetch(`${baseUrl}/api/v1/health`, {
      headers: headers(apiKey),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      status: data.status,
      ocrEnabled: data.ocr_enabled ?? data.ocrEnabled ?? false,
      version: data.version ?? "1.0.0",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function startPdfConversion(
  file: Buffer,
  fileName: string,
  options: { exportMode: ExportMode; baseName: string },
): Promise<ConvertStartResponse> {
  const { baseUrl, apiKey, timeoutMs } = getConverterConfig();
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(file)], { type: "application/pdf" }), fileName);
  formData.append("export_mode", options.exportMode);
  formData.append("base_name", options.baseName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/v1/convert`, {
      method: "POST",
      headers: headers(apiKey),
      body: formData,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new PdfConverterError(formatApiError(data) ?? "Konverzija nije uspela", res.status);
    }

    return {
      jobId: data.job_id ?? data.jobId,
      message: data.message ?? "Started",
    };
  } catch (error) {
    if (error instanceof PdfConverterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PdfConverterError("Konverzija je prekoračila vreme čekanja", 408);
    }
    throw new PdfConverterError(
      "PDF converter servis nije dostupan. Pokrenite backend: docker compose up pdf-converter",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getPdfConversionJob(jobId: string): Promise<PdfConvertJob> {
  const { baseUrl, apiKey, timeoutMs } = getConverterConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 30000));

  try {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${jobId}`, {
      headers: headers(apiKey),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new PdfConverterError(formatApiError(data) ?? "Job nije pronađen", res.status);
    }
    return mapJob(data);
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadPdfConversionExcel(jobId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const { baseUrl, apiKey, timeoutMs } = getConverterConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${jobId}/download`, {
      headers: headers(apiKey),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new PdfConverterError(formatApiError(data) ?? "Preuzimanje nije uspelo", res.status);
    }

    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const fileName = match?.[1] ?? "document.xlsx";
    const arrayBuffer = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), fileName };
  } finally {
    clearTimeout(timer);
  }
}
