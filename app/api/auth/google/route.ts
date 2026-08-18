import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next-path";
import {
  createGoogleOAuthState,
  googleAuthorizeUrl,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleStateCookieOptions,
  isGoogleOAuthConfigured,
} from "@/lib/google-oauth";
import { isAuthEnabled } from "@/lib/auth-config";

export async function GET(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!isGoogleOAuthConfigured()) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(login);
  }

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const remember = request.nextUrl.searchParams.get("remember") !== "0";
  const { state, nonce } = createGoogleOAuthState({ next, remember });

  const res = NextResponse.redirect(googleAuthorizeUrl(request, state));
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, googleStateCookieOptions());
  return res;
}
