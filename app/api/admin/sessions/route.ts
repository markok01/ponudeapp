import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
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

  if (userId === session.id) {
    return NextResponse.json(
      { error: "Koristite Odjava za sopstvenu sesiju" },
      { status: 400 },
    );
  }

  await revokeAllUserSessions(userId);
  return NextResponse.json({ ok: true, message: "Sve sesije korisnika su uklonjene" });
}
