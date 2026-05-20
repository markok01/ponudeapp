import { NextRequest, NextResponse } from "next/server";
import { getProductQuoteUsageCount } from "@/services/products";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const quoteCount = await getProductQuoteUsageCount(productId);
    return NextResponse.json({ quoteCount });
  } catch (error) {
    console.error("GET /api/products/[id]/usage", error);
    return NextResponse.json(
      { error: "Greška pri proveri upotrebe" },
      { status: 500 },
    );
  }
}
