import { NextRequest, NextResponse } from "next/server";
import { deleteQuote, getQuoteById, updateQuote } from "@/services/quotes";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const quote = await getQuoteById(quoteId);
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
    const { id } = await context.params;
    const quoteId = Number(id);
    if (!Number.isFinite(quoteId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const body = await request.json();
    const quote = await updateQuote(quoteId, {
      customer_name: body.customer_name,
      note: body.note,
      valid_until: body.valid_until,
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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteId = Number(id);
    if (!Number.isFinite(quoteId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    await deleteQuote(quoteId);
    return NextResponse.json({ message: "Ponuda obrisana" });
  } catch (error) {
    console.error("DELETE /api/quotes/[id]", error);
    const message =
      error instanceof Error ? error.message : "Greška pri brisanju ponude";
    const status = message.includes("nije pronađena") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
