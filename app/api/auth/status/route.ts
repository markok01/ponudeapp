import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAuthEnabled, SESSION_COOKIE } from "@/lib/auth";

/** @deprecated Koristite GET /api/auth/me */
export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();
  const user = authEnabled
    ? await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value)
    : null;
  return NextResponse.json({
    authEnabled,
    authenticated: authEnabled ? Boolean(user) : true,
    user: user ?? null,
  });
}
