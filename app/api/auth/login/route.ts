import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  countUsers,
  getUserByEmail,
} from "@/services/users";
import { DeviceLimitError } from "@/services/user-sessions";
import {
  establishUserSession,
  OrgSuspendedError,
} from "@/services/auth-session";
import {
  createSessionToken,
  getSessionMaxAgeSec,
  isAuthEnabled,
  isAuthRequired,
  isLegacyPasswordAuth,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyAppPassword,
} from "@/lib/auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import {
  checkRateLimit,
  clearRateLimit,
  getLoginRateLimitConfig,
  recordRateLimitFailure,
} from "@/lib/security/rate-limit";
import {
  evaluateLoginSuspicious,
  recordSuspiciousAlert,
} from "@/lib/security/suspicious";
import { getRequestSecurityMeta } from "@/lib/security/request-context";
import { getSessionClientInfo } from "@/lib/session-client-info";
import { authError } from "@/lib/authI18n";

export async function POST(request: NextRequest) {
  const meta = getRequestSecurityMeta(request);

  try {
    if (!isAuthEnabled()) {
      return NextResponse.json({ ok: true, authEnabled: false });
    }

    const body = await request.json();
    const remember = body.remember !== false;
    const maxAgeSec = getSessionMaxAgeSec(remember);

    if (isLegacyPasswordAuth()) {
      const password = String(body.password ?? "");
      if (!verifyAppPassword(password)) {
        await writeSecurityAuditLog({
          requestId: meta.requestId,
          eventType: "auth.login.failed",
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          failureReason: "legacy_invalid_password",
        });
        return authError(request, "wrong_password", 401);
      }
      const token = createSessionToken({ id: 0, email: "legacy@app" }, maxAgeSec);
      const response = NextResponse.json({ ok: true, authEnabled: true, legacy: true });
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));
      return response;
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return authError(request, "email_password_required", 400);
    }

    const existingAccount = await getUserByEmail(email);
    const isAdminTarget =
      existingAccount?.role === "admin" || existingAccount?.role === "owner";
    const rateKey = `${meta.ipAddress ?? "unknown"}:${email}`;
    const rate = await checkRateLimit(
      "login",
      rateKey,
      getLoginRateLimitConfig(isAdminTarget),
    );
    if (!rate.allowed) {
      await writeSecurityAuditLog({
        requestId: meta.requestId,
        eventType: "auth.login.rate_limited",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        failureReason: isAdminTarget ? "admin_login_rate_limit" : "login_rate_limit",
        metadata: { retryAfterSec: rate.retryAfterSec },
      });
      return authError(request, "too_many_login_attempts", 429);
    }

    if (isAuthRequired()) {
      const total = await countUsers();
      if (total === 0) {
        return authError(request, "no_users", 503);
      }
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      await recordRateLimitFailure(
        "login",
        rateKey,
        getLoginRateLimitConfig(isAdminTarget),
      );
      await writeSecurityAuditLog({
        requestId: meta.requestId,
        eventType: "auth.login.failed",
        action: "auth.login.failed",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        failureReason: "invalid_credentials",
        metadata: { adminTarget: isAdminTarget },
      });

      const failSuspicious = await evaluateLoginSuspicious({
        requestId: meta.requestId,
        userId: existingAccount?.id ?? 0,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        countryCode: null,
      });
      if (failSuspicious.alert) {
        await recordSuspiciousAlert({
          requestId: meta.requestId,
          actorUserId: existingAccount?.id ?? null,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          reasons: failSuspicious.reasons,
          context: { phase: "login_failed" },
        });
      }
      return authError(request, "invalid_credentials", 401);
    }

    if (!user.organization_id) {
      return authError(request, "account_not_linked", 403);
    }

    await clearRateLimit("login", rateKey);

    let response: NextResponse;
    try {
      response = await establishUserSession(request, user, remember, "password");
    } catch (err) {
      if (err instanceof OrgSuspendedError) {
        return authError(request, "org_suspended", 403);
      }
      if (err instanceof DeviceLimitError) {
        return authError(request, "device_limit", 403);
      }
      if (err instanceof Error && err.message === "session_persist_failed") {
        return authError(request, "session_persist_failed", 500);
      }
      throw err;
    }

    const loginSuspicious = await evaluateLoginSuspicious({
      requestId: meta.requestId,
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      countryCode: (await getSessionClientInfo(request)).geoCountryCode,
    });
    if (loginSuspicious.alert) {
      await recordSuspiciousAlert({
        requestId: meta.requestId,
        actorUserId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reasons: loginSuspicious.reasons,
        context: { phase: "login" },
      });
    }

    return response;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    const message = error instanceof Error ? error.message : "";

    if (message.includes("JWT_SECRET")) {
      return authError(request, "jwt_missing", 500);
    }
    if (
      message.includes("MYSQL_HOST") ||
      message.includes("MYSQL_PASSWORD") ||
      message.includes("MYSQL_DATABASE") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("Access denied")
    ) {
      return authError(request, "db_connection", 500);
    }
    if (message.includes("users") || message.includes("ER_NO_SUCH_TABLE")) {
      return authError(request, "wrong_database", 500);
    }

    return authError(request, "sign_in_failed", 500);
  }
}
