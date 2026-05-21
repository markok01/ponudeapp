import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  getSessionUser,
  SESSION_COOKIE,
} from "@/lib/auth";
import {
  listUserLoginSummaries,
  revokeAllUserSessions,
} from "@/services/user-sessions";

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }

  const users = await listUserLoginSummaries();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }

  const body = await request.json();
  const userId = Number(body.userId);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Neispravan ID korisnika" }, { status: 400 });
  }

  await revokeAllUserSessions(userId);

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
}
