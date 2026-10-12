import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { deleteQuote, getQuoteById, refreshQuotePrices, setQuoteStatus, updateQuote } from "@/services/quotes";
import { isQuoteLocked, isStoredQuoteStatus } from "@/lib/quote-status";
import { memberMayLockQuotes } from "@/lib/roles";
import { getAppSettingsFromDb } from "@/services/app-settings";
import { logOrgActivity } from "@/services/org-activity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const { id } = await context.params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const quote = await getQuoteById(ctx.organizationId, quoteId);
    if (!quote) {
      return NextResponse.json({ error: "Ponuda nije pronađena" }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error("GET /api/quotes/[id]", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju ponude" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const { id } = await context.params;
    const quoteId = Number(id);
    if (!Number.isFinite(quoteId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const body = await request.json();
    if (body.action === "refresh_prices") {
      const quote = await refreshQuotePrices(ctx.organizationId, quoteId);
      return NextResponse.json(quote);
    }
    if (body.status != null && body.items == null) {
      if (!isStoredQuoteStatus(body.status)) {
        return NextResponse.json({ error: "Neispravan status ponude" }, { status: 400 });
      }
      const settings = await getAppSettingsFromDb(ctx.organizationId);
      if (!memberMayLockQuotes(ctx.user?.role, settings.membersCanLockQuotes)) {
        return NextResponse.json(
          { error: "Samo administrator može da zaključa ili vrati ponudu" },
          { status: 403 },
        );
      }
      const quote = await setQuoteStatus(ctx.organizationId, quoteId, body.status);
      await logOrgActivity({
        organizationId: ctx.organizationId,
        actorUserId: ctx.user?.id,
        actorEmail: ctx.user?.email,
        action: "quote.status_changed",
        entityType: "quote",
        entityId: quoteId,
        summary: `Status ponude ${quote.quote_number || quoteId}: ${body.status}`,
        metadata: { status: body.status },
      });
      return NextResponse.json(quote);
    }
    const quote = await updateQuote(ctx.organizationId, quoteId, {
      customer_id: body.customer_id,
      customer_name: body.customer_name,
      note: body.note,
      valid_until: body.valid_until,
      currency: body.currency,
      items: body.items ?? [],
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error("PATCH /api/quotes/[id]", error);
    const message =
      error instanceof Error ? error.message : "Greška pri ažuriranju ponude";
    const status = message.includes("nije pronađena") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const { id } = await context.params;
    const quoteId = Number(id);
    if (!Number.isFinite(quoteId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const existing = await getQuoteById(ctx.organizationId, quoteId);
    if (!existing) {
      return NextResponse.json({ error: "Ponuda nije pronađena" }, { status: 404 });
    }
    if (isQuoteLocked(existing.status)) {
      const settings = await getAppSettingsFromDb(ctx.organizationId);
      if (!memberMayLockQuotes(ctx.user?.role, settings.membersCanLockQuotes)) {
        return NextResponse.json(
          { error: "Samo administrator može da obriše zaključanu ponudu" },
          { status: 403 },
        );
      }
    }
    await deleteQuote(ctx.organizationId, quoteId);
    return NextResponse.json({ message: "Ponuda obrisana" });
  } catch (error) {
    console.error("DELETE /api/quotes/[id]", error);
    const message =
      error instanceof Error ? error.message : "Greška pri brisanju ponude";
    const status = message.includes("nije pronađena") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
