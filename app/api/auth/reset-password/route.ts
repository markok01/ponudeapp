import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/services/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    if (!token.trim()) {
      return NextResponse.json({ error: "Link nije ispravan" }, { status: 400 });
    }
    await resetPasswordWithToken(token, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lozinka nije sačuvana";
    const safe =
      message.includes("Lozinka") || message.includes("Link")
        ? message
        : "Lozinka nije sačuvana. Zatražite novi link.";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
