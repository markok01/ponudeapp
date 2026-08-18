import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { getActiveProducts } from "@/services/products";
import { getActivePriceList, getPriceListById } from "@/services/price-list";
import { sortProductsCatalogOrder } from "@/utils/catalog-display";
import { buildCatalogExcelBuffer } from "@/utils/export-catalog-excel";
import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/currency";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const rawList = request.nextUrl.searchParams.get("priceListId");
    const priceListId = rawList ? Number(rawList) : undefined;
    const resolvedListId = Number.isFinite(priceListId) ? priceListId : undefined;
    const products = sortProductsCatalogOrder(
      await getActiveProducts(ctx.organizationId, {
        includeInactive: false,
        priceListId: resolvedListId,
      }),
    );
    const list = resolvedListId
      ? await getPriceListById(ctx.organizationId, resolvedListId)
      : await getActivePriceList(ctx.organizationId);
    const buffer = await buildCatalogExcelBuffer(
      products,
      list ? normalizeCurrency(list.currency) : DEFAULT_CURRENCY,
    );
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
