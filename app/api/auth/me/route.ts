import { NextResponse } from "next/server";
import { getSessionUser, isAuthEnabled } from "@/lib/auth";

export async function GET() {
  const authEnabled = isAuthEnabled();
  if (!authEnabled) {
    return NextResponse.json({ authEnabled: false, authenticated: true });
  }

  const user = await getSessionUser();
  return NextResponse.json({
    authEnabled: true,
    authenticated: Boolean(user),
    user: user ?? null,
  });
}
