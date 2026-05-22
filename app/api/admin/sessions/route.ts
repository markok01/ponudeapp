import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { withAdminApi } from "@/lib/security/admin-api";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import {
  listUserLoginSummaries,
  revokeAllUserSessions,
} from "@/services/user-sessions";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const users = await listUserLoginSummaries();
    return NextResponse.json({ users });
  });
}

export async function POST(request: NextRequest) {
  return withAdminApi(
    request,
    async ({ session, meta }) => {
    const body = await request.json();
    const userId = Number(body.userId);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Neispravan ID korisnika" }, { status: 400 });
    }

    await revokeAllUserSessions(userId);

    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "admin.sessions.revoked",
      actorUserId: session.id,
      targetUserId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { self: userId === session.id },
    });

    if (userId === session.id) {
      const res = NextResponse.json({
        ok: true,
        selfRevoked: true,
        message: "Odjavljeni ste sa svih uređaja",
      });
      res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
      return res;
    }

    return NextResponse.json({ ok: true, message: "Sve sesije korisnika su uklonjene" });
    },
    { sensitive: true },
  );
}
