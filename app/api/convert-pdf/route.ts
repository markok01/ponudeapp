import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { assertPdfConverterPlan, planGateResponse } from "@/lib/billing";
import {
  checkPdfConverterHealth,
  PdfConverterError,
  startPdfConversion,
} from "@/services/pdf-converter-client";
import { pdfConverterUnavailableMessage } from "@/lib/pdf-convert-errors";
import { tryLocalHorecaPdfToExcel } from "@/utils/horeca-pdf-convert";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF → Excel (upload). Na Vercelu odmah vraća jobId (bez čekanja Rendera u jednom requestu).
 * Klijent treba da polluje /api/pdf-convert/[jobId] — v. lib/client-pdf-convert.ts
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;
    await assertPdfConverterPlan(ctx.organizationId);

    const formData = await request.formData();
    const file = formData.get("file");
    const listName = String(formData.get("name") || "cenovnik");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "PDF fajl nije prosleđen" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Konverter prihvata samo .pdf fajlove" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const baseName = listName || file.name.replace(/\.pdf$/i, "");

    const remoteHealthy = await checkPdfConverterHealth();
    if (remoteHealthy) {
      const result = await startPdfConversion(buffer, file.name, {
        exportMode: "single_sheet",
        baseName,
      });
      return NextResponse.json({ async: true, jobId: result.jobId, message: result.message });
    }

    const localHoreca = await tryLocalHorecaPdfToExcel(buffer, baseName, file.name);
    if (localHoreca) {
      return NextResponse.json({
        rowCount: localHoreca.productCount,
        excelBase64: localHoreca.excelBuffer.toString("base64"),
        fileName: localHoreca.fileName,
        format: "horeca",
      });
    }

    return NextResponse.json({ error: pdfConverterUnavailableMessage() }, { status: 503 });
  } catch (error) {
    console.error("POST /api/convert-pdf", error);
    const gated = planGateResponse(error);
    if (gated) return gated;
    if (error instanceof PdfConverterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Konverzija PDF-a nije uspela";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
