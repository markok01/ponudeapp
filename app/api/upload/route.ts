import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireStaffOrganization } from "@/lib/org-session";
import { assertBillingAllowsWrites, planGateResponse } from "@/lib/billing";
import { importPriceListRows } from "@/services/price-list-import";
import { ensureDefaultPriceList } from "@/services/price-list";
import { parsePriceListFile } from "@/utils/price-list-parse";
import { logOrgActivity } from "@/services/org-activity";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireStaffOrganization(request);
    if (isOrgResponse(ctx)) return ctx;

    await assertBillingAllowsWrites(ctx.organizationId);

    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") || "merge").toLowerCase();
    const rawListId = Number(formData.get("priceListId"));

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Fajl nije prosleđen" }, { status: 400 });
    }

    if (file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        {
          error:
            "Za PDF prvo koristite „PDF → Excel” na stranici za upload, pa uvezite dobijeni .xlsx fajl.",
        },
        { status: 400 },
      );
    }

    const listId = Number.isFinite(rawListId) && rawListId > 0
      ? rawListId
      : (await ensureDefaultPriceList(ctx.organizationId)).id;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, source } = await parsePriceListFile(buffer, file.name);

    const stats = await importPriceListRows(ctx.organizationId, listId, rows, {
      fileName: file.name,
      replaceCatalog: mode === "replace",
    });

    await logOrgActivity({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user?.id,
      actorEmail: ctx.user?.email,
      action: "price_list.imported",
      entityType: "price_list",
      entityId: listId,
      summary: `Uvoz cenovnika „${file.name}” (${stats.inserted} novo, ${stats.updated} ažurirano)`,
      metadata: {
        fileName: file.name,
        inserted: stats.inserted,
        updated: stats.updated,
        mode: mode === "replace" ? "replace" : "merge",
      },
    });

    return NextResponse.json({
      ...stats,
      total: stats.inserted + stats.updated,
      source,
      rowCount: rows.length,
      mode: mode === "replace" ? "replace" : "merge",
    });
  } catch (error) {
    console.error("POST /api/upload", error);
    const gated = planGateResponse(error);
    if (gated) return gated;
    const message =
      error instanceof Error ? error.message : "Greška pri obradi cenovnika";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
