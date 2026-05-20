import { NextRequest, NextResponse } from "next/server";
import { previewPriceListImport } from "@/services/price-list-import";
import { parsePriceListFile } from "@/utils/price-list-parse";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Fajl nije prosleđen" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows } = await parsePriceListFile(buffer, file.name);
    const diff = await previewPriceListImport(rows);

    return NextResponse.json({
      ...diff,
      rowCount: rows.length,
      fileName: file.name,
    });
  } catch (error) {
    console.error("POST /api/upload/preview", error);
    const message =
      error instanceof Error ? error.message : "Pregled uvoza nije uspeo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
