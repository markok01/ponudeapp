import { NextRequest, NextResponse } from "next/server";
import { rollbackPriceListSnapshot } from "@/services/price-list";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const listId = Number(id);
    if (!Number.isFinite(listId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const result = await rollbackPriceListSnapshot(listId);
    return NextResponse.json({
      message: `Vraćeno ${result.restored} proizvoda iz snapshot-a`,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/price-lists/[id]/rollback", error);
    const message =
      error instanceof Error ? error.message : "Rollback nije uspeo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
