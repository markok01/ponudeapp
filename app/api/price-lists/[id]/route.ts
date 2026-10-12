import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId, requireStaffOrganization } from "@/lib/org-session";
import {
  archivePriceList,
  getPriceListById,
  setActivePriceList,
  updatePriceList,
} from "@/services/price-list";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;
    const { id } = await context.params;
    const listId = Number(id);
    if (!Number.isFinite(listId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }
    const list = await getPriceListById(ctx.organizationId, listId);
    if (!list) {
      return NextResponse.json({ error: "Cenovnik nije pronađen" }, { status: 404 });
    }
    return NextResponse.json(list);
  } catch (error) {
    console.error("GET /api/price-lists/[id]", error);
    return NextResponse.json({ error: "Greška pri učitavanju" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireStaffOrganization(request);
    if (isOrgResponse(ctx)) return ctx;
    const { id } = await context.params;
    const listId = Number(id);
    if (!Number.isFinite(listId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const body = (await request.json()) as {
      name?: string;
      currency?: string;
      active?: boolean;
      archived?: boolean;
    };

    if (body.archived === true) {
      await archivePriceList(ctx.organizationId, listId);
      return NextResponse.json({ ok: true, archived: true });
    }

    if (body.active === true) {
      const list = await setActivePriceList(ctx.organizationId, listId);
      return NextResponse.json(list);
    }

    if (body.name != null || body.currency != null) {
      const list = await updatePriceList(ctx.organizationId, listId, {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.currency != null ? { currency: body.currency } : {}),
      });
      return NextResponse.json(list);
    }

    const list = await getPriceListById(ctx.organizationId, listId);
    if (!list) {
      return NextResponse.json({ error: "Cenovnik nije pronađen" }, { status: 404 });
    }
    return NextResponse.json(list);
  } catch (error) {
    console.error("PATCH /api/price-lists/[id]", error);
    const message =
      error instanceof Error ? error.message : "Izmena cenovnika nije uspela";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
