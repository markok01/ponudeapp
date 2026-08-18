import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireStaffOrganization } from "@/lib/org-session";
import { previewPriceListImport } from "@/services/price-list-import";
import { ensureDefaultPriceList } from "@/services/price-list";
import { parsePriceListFile } from "@/utils/price-list-parse";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireStaffOrganization(request);
    if (isOrgResponse(ctx)) return ctx;

    const formData = await request.formData();
    const file = formData.get("file");
    const rawListId = Number(formData.get("priceListId"));

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Fajl nije prosleđen" }, { status: 400 });
    }

    const listId = Number.isFinite(rawListId) && rawListId > 0
      ? rawListId
      : (await ensureDefaultPriceList(ctx.organizationId)).id;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows } = await parsePriceListFile(buffer, file.name);
    const diff = await previewPriceListImport(ctx.organizationId, listId, rows);

    return NextResponse.json({
      ...diff,
      rowCount: rows.length,
      fileName: file.name,
    });
  } catch (error) {
    console.error("POST /api/upload/preview", error);
    const message =
      error instanceof Error ? error.message : "Pregled uvoza nije uspeo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
