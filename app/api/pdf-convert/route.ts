import { NextRequest, NextResponse } from "next/server";
import {
  checkPdfConverterHealth,
  isPdfConverterUrlConfigured,
  PdfConverterError,
  startPdfConversion,
} from "@/services/pdf-converter-client";
import { pdfConverterUnavailableMessage } from "@/lib/pdf-convert-errors";
import { tryLocalHorecaPdfToExcel } from "@/utils/horeca-pdf-convert";
import type { ExportMode } from "@/types/pdf-converter";

export const runtime = "nodejs";
export const maxDuration = 300;

function syncHorecaResponse(result: {
  excelBuffer: Buffer;
  fileName: string;
  productCount: number;
  sheetCount: number;
}) {
  return NextResponse.json({
    jobId: `horeca-${Date.now()}`,
    message: "HoReCa konverzija završena (pdfplumber)",
    sync: true,
    status: "completed",
    progress: 100,
    fileName: result.fileName,
    rowCount: result.productCount,
    sheetCount: result.sheetCount,
    excelBase64: result.excelBuffer.toString("base64"),
    format: "horeca",
  });
}

export async function GET() {
  const configured = isPdfConverterUrlConfigured();
  const localHorecaSync = !process.env.VERCEL;
  const health = await checkPdfConverterHealth();
  if (!health) {
    return NextResponse.json({
      available: false,
      configured,
      localHorecaSync,
      error: pdfConverterUnavailableMessage(),
    });
  }
  return NextResponse.json({ available: true, configured, localHorecaSync, ...health });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const exportMode = (formData.get("exportMode") || "single_sheet") as ExportMode;
    const baseName = String(formData.get("baseName") || "document");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "PDF fajl nije prosleđen" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Samo .pdf fajlovi su podržani" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    /** 1) Primarni put: Python FastAPI (pdfplumber, camelot, OCR) — bilo koji PDF. */
    const health = await checkPdfConverterHealth();
    if (health) {
      const result = await startPdfConversion(buffer, file.name, { exportMode, baseName });
      return NextResponse.json(result);
    }

    /** 2) Lokalno: sync HoReCa preko scripts/horeca-from-pdf.py (pdfplumber tabele). */
    const localHoreca = await tryLocalHorecaPdfToExcel(buffer, baseName, file.name);
    if (localHoreca) {
      return syncHorecaResponse(localHoreca);
    }

    return NextResponse.json({ error: pdfConverterUnavailableMessage() }, { status: 503 });
  } catch (error) {
    console.error("POST /api/pdf-convert", error);
    if (error instanceof PdfConverterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Konverzija nije uspela";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
