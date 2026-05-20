import { NextResponse } from "next/server";
import { getSessionUser, isAuthEnabled } from "@/lib/auth";

/** @deprecated Koristite GET /api/auth/me */
export async function GET() {
  const authEnabled = isAuthEnabled();
  const user = authEnabled ? await getSessionUser() : null;
  return NextResponse.json({
    authEnabled,
    authenticated: authEnabled ? Boolean(user) : true,
    user: user ?? null,
  });
}
