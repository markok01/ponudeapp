import { NextResponse } from "next/server";
import { listPriceListRecords } from "@/services/price-list";

export async function GET() {
  try {
    const records = await listPriceListRecords(15);
    return NextResponse.json(records);
  } catch (error) {
    console.error("GET /api/price-lists", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju istorije uvoza" },
      { status: 500 },
    );
  }
}
