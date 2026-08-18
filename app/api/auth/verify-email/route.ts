import { NextRequest, NextResponse } from "next/server";
import { AuthCodedError } from "@/lib/auth-error-codes";
import { authError } from "@/lib/authI18n";
import { verifyEmailToken } from "@/services/email-verification";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  try {
    const result = await verifyEmailToken(token);
    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    if (error instanceof AuthCodedError) {
      return authError(request, error.code, 400);
    }
    return authError(request, "verify_failed", 400);
  }
}
