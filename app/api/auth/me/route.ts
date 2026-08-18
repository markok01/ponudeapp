import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAuthEnabled, parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getOrganizationById } from "@/services/organizations";

export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();
  if (!authEnabled) {
    return NextResponse.json({ authEnabled: false, authenticated: true });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  try {
    const user = await getSessionUser(token);
    const org = user
      ? await getOrganizationById(user.organizationId)
      : null;
    const organization = org
      ? {
          id: org.id,
          name: org.name,
          onboardingCompleted: org.onboarding_completed,
        }
      : null;

    if (process.env.AUTH_DEBUG === "1") {
      const payload = parseSessionToken(token);
      return NextResponse.json({
        authEnabled: true,
        authenticated: Boolean(user),
        user: user ?? null,
        organization,
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
      organization,
    });
  } catch (error) {
    console.error("GET /api/auth/me", error);
    return NextResponse.json(
      { authEnabled: true, error: "session_check_unavailable" },
      { status: 503 },
    );
  }
}
