import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  parseSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { getRequestSecurityMeta } from "@/lib/security/request-context";
import { revokeUserSession } from "@/services/user-sessions";

export async function POST(request: NextRequest) {
  const meta = getRequestSecurityMeta(request);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = parseSessionToken(token);

  if (payload?.sid) {
    await revokeUserSession(payload.sid);
  }

  await writeSecurityAuditLog({
    requestId: meta.requestId,
    eventType: "auth.logout",
    actorUserId: payload?.userId ?? null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  response.headers.set("x-request-id", meta.requestId);
  return response;
}
