import { NextRequest, NextResponse } from "next/server";
import {
  clearGoogleStateCookieOptions,
  createPendingGoogleSignup,
  exchangeGoogleCode,
  GOOGLE_COMPLETE_PATH,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_PENDING_COOKIE,
  googleStateCookieOptions,
  isGoogleOAuthConfigured,
  parseGoogleOAuthState,
} from "@/lib/google-oauth";
import { GoogleAuthError, resolveGoogleUser } from "@/services/auth-google";
import { establishUserSession, OrgSuspendedError } from "@/services/auth-session";
import { DeviceLimitError } from "@/services/user-sessions";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { getRequestSecurityMeta } from "@/lib/security/request-context";
import {
  checkRateLimit,
  getLoginRateLimitConfig,
  recordRateLimitFailure,
} from "@/lib/security/rate-limit";

function loginErrorRedirect(request: NextRequest, code: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearGoogleStateCookieOptions());
  res.cookies.set(GOOGLE_PENDING_COOKIE, "", clearGoogleStateCookieOptions());
  return res;
}

export async function GET(request: NextRequest) {
  const meta = getRequestSecurityMeta(request);

  if (!isGoogleOAuthConfigured()) {
    return loginErrorRedirect(request, "google_not_configured");
  }

  const denied = request.nextUrl.searchParams.get("error");
  if (denied) {
    return loginErrorRedirect(request, "google_denied");
  }

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const stateParam = request.nextUrl.searchParams.get("state") ?? "";
  const cookieNonce = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const parsed = parseGoogleOAuthState(stateParam);

  if (!code || !parsed || !cookieNonce || cookieNonce !== parsed.nonce) {
    console.warn("[google-oauth] state check failed", {
      hasCode: Boolean(code),
      hasParsed: Boolean(parsed),
      hasCookie: Boolean(cookieNonce),
    });
    return loginErrorRedirect(request, "google_failed");
  }

  const rateKey = meta.ipAddress ?? "unknown";
  const rateCfg = getLoginRateLimitConfig(false);
  const rate = await checkRateLimit("google_oauth", rateKey, rateCfg);
  if (!rate.allowed) {
    return loginErrorRedirect(request, "google_rate_limited");
  }

  try {
    const profile = await exchangeGoogleCode(request, code);
    const resolved = await resolveGoogleUser(profile);
    if (resolved.kind === "complete_profile") {
      const complete = new URL(GOOGLE_COMPLETE_PATH, request.url);
      const res = NextResponse.redirect(complete);
      res.cookies.set(
        GOOGLE_OAUTH_STATE_COOKIE,
        "",
        clearGoogleStateCookieOptions(),
      );
      res.cookies.set(
        GOOGLE_PENDING_COOKIE,
        createPendingGoogleSignup({
          sub: resolved.profile.sub,
          email: resolved.profile.email,
          name: resolved.profile.name,
          remember: parsed.remember,
          next: parsed.next,
        }),
        googleStateCookieOptions(),
      );
      return res;
    }
    const sessionRes = await establishUserSession(
      request,
      resolved.user,
      parsed.remember,
      "google",
      { redirectTo: parsed.next },
    );
    sessionRes.cookies.set(
      GOOGLE_OAUTH_STATE_COOKIE,
      "",
      clearGoogleStateCookieOptions(),
    );
    return sessionRes;
  } catch (error) {
    await recordRateLimitFailure("google_oauth", rateKey, rateCfg).catch(
      () => undefined,
    );
    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "auth.login.failed",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      failureReason:
        error instanceof GoogleAuthError ? error.code : "google_failed",
      metadata: { provider: "google" },
    });

    if (error instanceof OrgSuspendedError) {
      return loginErrorRedirect(request, "org_suspended");
    }
    if (error instanceof DeviceLimitError) {
      return loginErrorRedirect(request, "device_limit");
    }
    if (error instanceof GoogleAuthError) {
      return loginErrorRedirect(request, error.code);
    }
    console.error("GET /api/auth/google/callback", error);
    return loginErrorRedirect(request, "google_failed");
  }
}
