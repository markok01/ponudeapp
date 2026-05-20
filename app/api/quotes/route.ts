import { NextRequest, NextResponse } from "next/server";
import { createQuote, listQuotes } from "@/services/quotes";

export async function GET() {
  try {
    const quotes = await listQuotes();
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
    const body = await request.json();
    const quote = await createQuote(body);
    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("POST /api/quotes", error);
    const message =
      error instanceof Error ? error.message : "Greška pri kreiranju ponude";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
