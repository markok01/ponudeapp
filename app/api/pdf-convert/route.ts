import { NextRequest, NextResponse } from "next/server";
import {
  checkPdfConverterHealth,
  PdfConverterError,
  startPdfConversion,
} from "@/services/pdf-converter-client";
import { convertHorecaPdfToExcel } from "@/utils/horeca-pdf-convert";
import type { ExportMode } from "@/types/pdf-converter";

export const runtime = "nodejs";
export const maxDuration = 300;

const isVercel = Boolean(process.env.VERCEL);

export async function GET() {
  const health = await checkPdfConverterHealth();
  if (!health) {
    return NextResponse.json(
      { available: false, error: "PDF converter servis nije dostupan" },
    );
  }
  return NextResponse.json({ available: true, ...health });
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

    const health = await checkPdfConverterHealth();

    if (health) {
      const result = await startPdfConversion(buffer, file.name, { exportMode, baseName });
      return NextResponse.json(result);
    }

    if (!isVercel) {
      try {
        const { excelBuffer, fileName, productCount, sheetCount } =
          await convertHorecaPdfToExcel(buffer, baseName);

        return NextResponse.json({
          jobId: `horeca-${Date.now()}`,
          message: "HoReCa konverzija završena",
          sync: true,
          status: "completed",
          progress: 100,
          fileName,
          rowCount: productCount,
          sheetCount,
          excelBase64: excelBuffer.toString("base64"),
          format: "horeca",
        });
      } catch (horecaError) {
        console.warn("HoReCa local parser:", horecaError);
      }
    }

    return NextResponse.json(
      {
        error: isVercel
          ? "PDF converter servis nije dostupan. Proverite PDF_CONVERTER_URL na Vercelu."
          : "Za generičke PDF-ove pokrenite: docker compose up pdf-converter.",
      },
      { status: 503 },
    );
  } catch (error) {
    console.error("POST /api/pdf-convert", error);
    if (error instanceof PdfConverterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Konverzija nije uspela";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
