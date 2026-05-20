import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { revokeUserSession } from "@/services/user-sessions";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = parseSessionToken(token);
  if (payload?.sid) {
    await revokeUserSession(payload.sid);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
