import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { assertBillingAllowsWrites, planGateResponse } from "@/lib/billing";
import { createQuote, listQuotes } from "@/services/quotes";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const quotes = await listQuotes(ctx.organizationId);
    return NextResponse.json(quotes);
  } catch (error) {
    console.error("GET /api/quotes", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju ponuda" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    await assertBillingAllowsWrites(ctx.organizationId);
    const body = await request.json();
    const quote = await createQuote(ctx.organizationId, body);
    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("POST /api/quotes", error);
    const gated = planGateResponse(error);
    if (gated) return gated;
    const message =
      error instanceof Error ? error.message : "Greška pri kreiranju ponude";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
