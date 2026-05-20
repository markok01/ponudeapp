import { NextRequest, NextResponse } from "next/server";
import {
  checkPdfConverterHealth,
  convertPdfRemotely,
  PdfConverterError,
} from "@/services/pdf-converter-client";
import { convertHorecaPdfToExcel, isLikelyHorecaFile } from "@/utils/horeca-pdf-convert";
import { convertPdfToExcel } from "@/utils/price-list-parse";

export const runtime = "nodejs";
export const maxDuration = 300;

const isVercel = Boolean(process.env.VERCEL);

/** PDF → Excel (upload stranica). Na Vercelu koristi Render; lokalno Python HoReCa pa Render pa jednostavan parser. */
export async function POST(request: NextRequest) {
  try {
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
    const likelyHoreca = isLikelyHorecaFile(file.name) || isLikelyHorecaFile(baseName);

    const remoteHealthy = await checkPdfConverterHealth();

    if (remoteHealthy) {
      const { buffer: excelBuffer, fileName, rowCount } = await convertPdfRemotely(
        buffer,
        file.name,
        { baseName, exportMode: "multiple_sheets" },
      );

      return NextResponse.json({
        rowCount: rowCount ?? 0,
        excelBase64: excelBuffer.toString("base64"),
        fileName,
        format: likelyHoreca ? "horeca" : "remote",
      });
    }

    if (!isVercel) {
      try {
        const { excelBuffer, fileName, productCount } = await convertHorecaPdfToExcel(
          buffer,
          baseName,
        );
        return NextResponse.json({
          rowCount: productCount,
          excelBase64: excelBuffer.toString("base64"),
          fileName,
          format: "horeca",
        });
      } catch (horecaError) {
        console.warn("HoReCa local parser failed:", horecaError);
      }

      try {
        const { rows, excelBuffer, fileName } = await convertPdfToExcel(buffer, baseName);
        return NextResponse.json({
          rowCount: rows.length,
          excelBase64: excelBuffer.toString("base64"),
          fileName,
          format: "simple",
        });
      } catch (simpleError) {
        console.warn("Simple PDF parser failed:", simpleError);
      }
    }

    return NextResponse.json(
      {
        error: isVercel
          ? "PDF converter servis nije dostupan. Proverite PDF_CONVERTER_URL na Vercelu i da Render servis radi."
          : "PDF converter nije dostupan. Pokrenite: docker compose up pdf-converter",
      },
      { status: 503 },
    );
  } catch (error) {
    console.error("POST /api/convert-pdf", error);
    if (error instanceof PdfConverterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Konverzija PDF-a nije uspela";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
