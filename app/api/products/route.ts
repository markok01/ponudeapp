import { NextRequest, NextResponse } from "next/server";
import {
  createProduct,
  getProductCategories,
  getProductsPaginated,
} from "@/services/products";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const includeInactive = searchParams.get("all") === "1";
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "100");

    const [result, categories] = await Promise.all([
      getProductsPaginated({
        search,
        category,
        includeInactive,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 100,
      }),
      getProductCategories(),
    ]);

    return NextResponse.json({ ...result, categories });
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
    const body = await request.json();
    const { sku, name, category, price, pdv_percent, active } = body;

    if (!sku?.trim() || !name?.trim() || price == null) {
      return NextResponse.json(
        { error: "SKU, naziv i cena su obavezni" },
        { status: 400 },
      );
    }

    const product = await createProduct({
      sku,
      name,
      category,
      price: Number(price),
      pdv_percent: pdv_percent != null ? Number(pdv_percent) : 20,
      active,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/products", error);
    const message =
      error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY"
        ? "SKU već postoji"
        : "Greška pri kreiranju proizvoda";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
