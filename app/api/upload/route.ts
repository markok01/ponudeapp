import { NextRequest, NextResponse } from "next/server";
import { importPriceListRows } from "@/services/price-list-import";
import { parsePriceListFile } from "@/utils/price-list-parse";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const listName = String(formData.get("name") || "Cenovnik");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Fajl nije prosleđen" }, { status: 400 });
    }

    if (file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        {
          error:
            "Za PDF prvo koristite „PDF → Excel” na stranici za upload, pa uvezite dobijeni .xlsx fajl.",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, source } = await parsePriceListFile(buffer, file.name);

    const stats = await importPriceListRows(rows, listName, {
      fileName: file.name,
    });

    return NextResponse.json({
      ...stats,
      total: stats.inserted + stats.updated,
      source,
      rowCount: rows.length,
    });
  } catch (error) {
    console.error("POST /api/upload", error);
    const message =
      error instanceof Error ? error.message : "Greška pri obradi cenovnika";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
