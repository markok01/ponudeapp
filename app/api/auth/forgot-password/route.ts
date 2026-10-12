import { NextRequest, NextResponse } from "next/server";
import { getRequestLocale } from "@/lib/authI18n";
import { checkRateLimit, getSignupRateLimitConfig } from "@/lib/security/rate-limit";
import { requestPasswordReset } from "@/services/password-reset";

export async function POST(request: NextRequest) {
  try {
    const metaIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rate = await checkRateLimit("password_reset", metaIp, getSignupRateLimitConfig());
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Previše zahteva. Pokušajte kasnije." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email.includes("@")) {
      await requestPasswordReset(email, request, getRequestLocale(request));
    }
    return NextResponse.json({
      ok: true,
      message:
        "Ako nalog postoji, poslali smo link za novu lozinku. Proverite poštu.",
    });
  } catch (error) {
    console.error("POST /api/auth/forgot-password", error);
    return NextResponse.json(
      { error: "Slanje linka nije uspelo. Pokušajte ponovo." },
      { status: 500 },
    );
  }
}
