import { NextRequest, NextResponse } from "next/server";
import { convertHorecaPdfToExcel } from "@/utils/horeca-pdf-convert";
import { convertPdfToExcel } from "@/utils/price-list-parse";

export const runtime = "nodejs";
export const maxDuration = 300;

/** PDF → HoReCa Excel (identičan format: boje, brendovi, kolone). */
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

    try {
      const { excelBuffer, fileName, productCount } = await convertHorecaPdfToExcel(
        buffer,
        listName,
      );
      return NextResponse.json({
        rowCount: productCount,
        excelBase64: excelBuffer.toString("base64"),
        fileName,
        format: "horeca",
      });
    } catch (horecaError) {
      console.warn("HoReCa parser failed, fallback:", horecaError);
    }

    const { rows, excelBuffer, fileName } = await convertPdfToExcel(buffer, listName);
    return NextResponse.json({
      rowCount: rows.length,
      excelBase64: excelBuffer.toString("base64"),
      fileName,
      format: "simple",
    });
  } catch (error) {
    console.error("POST /api/convert-pdf", error);
    const message =
      error instanceof Error ? error.message : "Konverzija PDF-a nije uspela";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
