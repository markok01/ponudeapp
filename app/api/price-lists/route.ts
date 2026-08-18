import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { assertCanCreatePriceList, planGateResponse } from "@/lib/billing";
import { getAppSettingsFromDb } from "@/services/app-settings";
import {
  createPriceList,
  listPriceLists,
  parsePriceListTemplate,
} from "@/services/price-list";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const includeArchived = request.nextUrl.searchParams.get("archived") === "1";
    const lists = await listPriceLists(ctx.organizationId, { includeArchived });
    return NextResponse.json(lists);
  } catch (error) {
    console.error("GET /api/price-lists", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju cenovnika" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    await assertCanCreatePriceList(ctx.organizationId);
    const body = (await request.json()) as {
      name?: string;
      template?: string;
      active?: boolean;
      currency?: string;
    };
    const settings = await getAppSettingsFromDb(ctx.organizationId);
    const list = await createPriceList(ctx.organizationId, {
      name: String(body.name ?? "").trim() || "Cenovnik",
      template: parsePriceListTemplate(body.template),
      activate: body.active !== false,
      currency: body.currency ?? settings.currency,
    });
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    console.error("POST /api/price-lists", error);
    const gated = planGateResponse(error);
    if (gated) return gated;
    const message =
      error instanceof Error ? error.message : "Cenovnik nije kreiran";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
