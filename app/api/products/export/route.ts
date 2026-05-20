import { NextResponse } from "next/server";
import { getActiveProducts } from "@/services/products";
import { sortProductsCatalogOrder } from "@/utils/catalog-display";
import { buildCatalogExcelBuffer } from "@/utils/export-catalog-excel";

export async function GET() {
  try {
    const products = sortProductsCatalogOrder(
      await getActiveProducts({ includeInactive: false }),
    );
    const buffer = await buildCatalogExcelBuffer(products);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="cenovnik-export.xlsx"',
      },
    });
  } catch (error) {
    console.error("GET /api/products/export", error);
    return NextResponse.json(
      { error: "Export cenovnika nije uspeo" },
      { status: 500 },
    );
  }
}
