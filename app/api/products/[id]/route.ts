import { NextRequest, NextResponse } from "next/server";
import { deleteProduct, getProductById, updateProduct } from "@/services/products";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const existing = await getProductById(id);
    if (!existing) {
      return NextResponse.json({ error: "Proizvod nije pronađen" }, { status: 404 });
    }

    const body = await request.json();
    const { sku, name, category, price, pdv_percent, active } = body;

    if (price != null && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      return NextResponse.json({ error: "Neispravna cena" }, { status: 400 });
    }

    if (pdv_percent != null) {
      const pdv = Number(pdv_percent);
      if (Number.isNaN(pdv) || pdv < 0 || pdv > 100) {
        return NextResponse.json({ error: "PDV mora biti 0–100" }, { status: 400 });
      }
    }

    const product = await updateProduct(id, {
      ...(sku !== undefined ? { sku: String(sku) } : {}),
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(category !== undefined ? { category: category as string | null } : {}),
      ...(price != null ? { price: Number(price) } : {}),
      ...(pdv_percent != null ? { pdv_percent: Number(pdv_percent) } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    });

    return NextResponse.json(product);
  } catch (error: unknown) {
    console.error("PATCH /api/products/[id]", error);
    const message =
      error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY"
        ? "Šifra već postoji"
        : error instanceof Error
          ? error.message
          : "Greška pri ažuriranju proizvoda";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const result = await deleteProduct(id);
    const message =
      result.action === "deactivated"
        ? "Proizvod je u ponudi — uklonjen iz cenovnika (deaktiviran)"
        : "Proizvod obrisan";

    return NextResponse.json({ ...result, message });
  } catch (error) {
    console.error("DELETE /api/products/[id]", error);
    const message =
      error instanceof Error ? error.message : "Greška pri brisanju proizvoda";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
