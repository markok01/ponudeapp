import { NextRequest, NextResponse } from "next/server";
import {
  getSessionUser,
  isAuthEnabled,
  parseSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();
  if (!authEnabled) {
    return NextResponse.json({ authEnabled: false, authenticated: true });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(token);

  if (process.env.AUTH_DEBUG === "1") {
    const payload = parseSessionToken(token);
    return NextResponse.json({
      authEnabled: true,
      authenticated: Boolean(user),
      user: user ?? null,
      debug: {
        hasToken: Boolean(token),
        tokenLen: token?.length ?? 0,
        payloadUserId: payload?.userId ?? null,
      },
    });
  }

  return NextResponse.json({
    authEnabled: true,
    authenticated: Boolean(user),
    user: user ?? null,
  });
}
