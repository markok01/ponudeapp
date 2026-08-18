import { NextRequest, NextResponse } from "next/server";
import {
  clearGoogleStateCookieOptions,
  GOOGLE_PENDING_COOKIE,
  parsePendingGoogleSignup,
} from "@/lib/google-oauth";
import { completeGoogleSignup, GoogleAuthError } from "@/services/auth-google";
import { establishUserSession, OrgSuspendedError } from "@/services/auth-session";
import { DeviceLimitError } from "@/services/user-sessions";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { getRequestSecurityMeta } from "@/lib/security/request-context";
import { AuthCodedError } from "@/lib/auth-error-codes";
import { authError } from "@/lib/authI18n";
import { PasswordPolicyError } from "@/lib/security/password-policy";
import {
  checkRateLimit,
  getSignupRateLimitConfig,
  recordRateLimitFailure,
} from "@/lib/security/rate-limit";

function clearPending(res: NextResponse) {
  res.cookies.set(GOOGLE_PENDING_COOKIE, "", clearGoogleStateCookieOptions());
  return res;
}

export async function GET(request: NextRequest) {
  const pending = parsePendingGoogleSignup(
    request.cookies.get(GOOGLE_PENDING_COOKIE)?.value,
  );
  if (!pending) {
    return authError(request, "google_pending_expired", 401);
  }
  return NextResponse.json({
    email: pending.email,
    name: pending.name,
    next: pending.next,
  });
}

export async function POST(request: NextRequest) {
  const meta = getRequestSecurityMeta(request);
  const pending = parsePendingGoogleSignup(
    request.cookies.get(GOOGLE_PENDING_COOKIE)?.value,
  );
  if (!pending) {
    return authError(request, "google_pending_expired", 401);
  }

  const rateKey = meta.ipAddress ?? "unknown";
  const rateCfg = getSignupRateLimitConfig();

  try {
    const rate = await checkRateLimit("signup", rateKey, rateCfg);
    if (!rate.allowed) {
      return authError(request, "signup_rate_limited", 429);
    }

    const body = (await request.json()) as {
      personName?: string;
      companyName?: string;
    };
    const user = await completeGoogleSignup({
      sub: pending.sub,
      email: pending.email,
      personName: String(body.personName ?? pending.name ?? ""),
      companyName: String(body.companyName ?? ""),
    });

    const sessionRes = await establishUserSession(
      request,
      user,
      pending.remember,
      "google",
    );
    clearPending(sessionRes);
    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "auth.signup.success",
      actorUserId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { provider: "google" },
    });
    return sessionRes;
  } catch (error) {
    await recordRateLimitFailure("signup", rateKey, rateCfg).catch(() => undefined);
    if (error instanceof OrgSuspendedError) {
      return clearPending(authError(request, "org_suspended", 403));
    }
    if (error instanceof DeviceLimitError) {
      return authError(request, "device_limit", 403);
    }
    if (error instanceof GoogleAuthError) {
      return authError(request, error.code, 400);
    }
    if (error instanceof PasswordPolicyError) {
      return authError(request, "password_policy", 400, { reasons: error.reasons });
    }
    if (error instanceof AuthCodedError) {
      return authError(request, error.code, 400);
    }
    console.error("POST /api/auth/google/complete", error);
    return authError(request, "register_failed", 400);
  }
}
