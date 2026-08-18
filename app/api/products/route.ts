import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import {
  createProduct,
  getProductCategories,
  getProductsPaginated,
} from "@/services/products";
import { getActivePriceList, getPriceListById } from "@/services/price-list";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const includeInactive = searchParams.get("all") === "1";
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "100");
    const rawList = searchParams.get("priceListId");
    const priceListId = rawList ? Number(rawList) : undefined;

    const [result, categories, activeList] = await Promise.all([
      getProductsPaginated(ctx.organizationId, {
        search,
        category,
        includeInactive,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 100,
        priceListId: Number.isFinite(priceListId) ? priceListId : undefined,
      }),
      getProductCategories(
        ctx.organizationId,
        Number.isFinite(priceListId) ? priceListId : undefined,
      ),
      getActivePriceList(ctx.organizationId),
    ]);

    const list = Number.isFinite(priceListId)
      ? await getPriceListById(ctx.organizationId, priceListId!)
      : activeList;

    return NextResponse.json({
      ...result,
      categories,
      priceList: list
        ? {
            id: list.id,
            name: list.name,
            template: list.template,
            active: list.active,
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/products", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju proizvoda" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const body = await request.json();
    const { sku, name, category, price, pdv_percent, measure_unit, active, priceListId } =
      body as {
        sku?: string;
        name?: string;
        category?: string;
        price?: number;
        pdv_percent?: number;
        measure_unit?: string;
        active?: boolean;
        priceListId?: number;
      };

    if (!name?.trim() || price == null) {
      return NextResponse.json(
        { error: "Naziv i cena su obavezni" },
        { status: 400 },
      );
    }

    const product = await createProduct(ctx.organizationId, {
      sku: sku ?? "",
      name,
      category,
      price: Number(price),
      pdv_percent: pdv_percent != null ? Number(pdv_percent) : 20,
      measure_unit,
      active,
      price_list_id: Number.isFinite(Number(priceListId)) ? Number(priceListId) : undefined,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/products", error);
    const message =
      error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY"
        ? "SKU već postoji u ovom cenovniku"
        : error instanceof Error
          ? error.message
          : "Greška pri kreiranju proizvoda";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
