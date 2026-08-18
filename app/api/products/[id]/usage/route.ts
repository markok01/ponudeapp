import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { getProductQuoteUsageCount } from "@/services/products";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const quoteCount = await getProductQuoteUsageCount(ctx.organizationId, productId);
    return NextResponse.json({ quoteCount });
  } catch (error) {
    console.error("GET /api/products/[id]/usage", error);
    return NextResponse.json(
      { error: "Greška pri proveri upotrebe" },
      { status: 500 },
    );
  }
}
