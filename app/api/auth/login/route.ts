import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  countUsers,
  getUserByEmail,
} from "@/services/users";
import {
  createUserSession,
  DeviceLimitError,
  getValidUserSession,
  revokeUserSession,
} from "@/services/user-sessions";
import {
  createSessionToken,
  getSessionMaxAgeSec,
  isAuthEnabled,
  isAuthRequired,
  isLegacyPasswordAuth,
  parseSessionToken,
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
  DEVICE_COOKIE,
  deviceCookieOptions,
  generateDeviceId,
  readDeviceIdFromRequest,
} from "@/lib/security/device-id";
import { buildTrustForLogin } from "@/lib/security/session-trust";
import {
  evaluateLoginSuspicious,
  recordSuspiciousAlert,
} from "@/lib/security/suspicious";
import { getRequestSecurityMeta } from "@/lib/security/request-context";
import { getSessionClientInfo } from "@/lib/session-client-info";

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
        return NextResponse.json({ error: "Pogrešna lozinka" }, { status: 401 });
      }
      const token = createSessionToken({ id: 0, email: "legacy@app" }, maxAgeSec);
      const response = NextResponse.json({ ok: true, authEnabled: true, legacy: true });
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));
      return response;
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email i lozinka su obavezni" },
        { status: 400 },
      );
    }

    const existingAccount = await getUserByEmail(email);
    const isAdminTarget = existingAccount?.role === "admin";
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
      return NextResponse.json(
        { error: "Previše pokušaja prijave. Pokušajte kasnije." },
        { status: 429 },
      );
    }

    if (isAuthRequired()) {
      const total = await countUsers();
      if (total === 0) {
        return NextResponse.json(
          {
            error:
              "Nema kreiranih naloga. Pokrenite: node scripts/create-user.mjs",
          },
          { status: 503 },
        );
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
      return NextResponse.json(
        { error: "Pogrešan email ili lozinka" },
        { status: 401 },
      );
    }

    await clearRateLimit("login", rateKey);

    const existingToken = request.cookies.get(SESSION_COOKIE)?.value;
    const existing = parseSessionToken(existingToken);
    if (existing?.userId === user.id && existing.sid) {
      await revokeUserSession(existing.sid);
    }

    const clientInfo = await getSessionClientInfo(request);
    const deviceId = readDeviceIdFromRequest(request) ?? generateDeviceId();
    const trust = await buildTrustForLogin({
      userId: user.id,
      deviceId,
      client: clientInfo,
    });

    let sessionId: string;
    try {
      sessionId = await createUserSession(user.id, maxAgeSec, clientInfo, {
        deviceId,
        trustScore: trust.trustScore,
        trustLevel: trust.trustLevel,
      });
    } catch (err) {
      if (err instanceof DeviceLimitError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: 403 },
        );
      }
      throw err;
    }

    const sessionOk = await getValidUserSession(sessionId, user.id);
    if (!sessionOk) {
      console.error("POST /api/auth/login — session not persisted", {
        userId: user.id,
        sidPrefix: sessionId.slice(0, 8),
      });
      return NextResponse.json(
        {
          error:
            "Sesija nije sačuvana u bazi (user_sessions.token_hash). Pokrenite scripts/ponudaapp-create-auth-tables.sql na bazi ponudaapp.",
          code: "session_persist_failed",
        },
        { status: 500 },
      );
    }

    const token = createSessionToken(
      {
        id: user.id,
        email: user.email,
        sessionVersion: user.session_version,
        sessionId,
      },
      maxAgeSec,
    );

    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "auth.login.success",
      action: "auth.login.success",
      actorUserId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        role: user.role,
        countryCode: clientInfo.geoCountryCode,
        trustScore: trust.trustScore,
        trustLevel: trust.trustLevel,
        deviceId,
      },
    });

    const loginSuspicious = await evaluateLoginSuspicious({
      requestId: meta.requestId,
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      countryCode: clientInfo.geoCountryCode,
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

    const response = NextResponse.json({
      ok: true,
      authEnabled: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));
    response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
    response.headers.set("x-request-id", meta.requestId);
    return response;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    const message = error instanceof Error ? error.message : "";

    if (message.includes("JWT_SECRET")) {
      return NextResponse.json(
        { error: "JWT_SECRET nije podešen na serveru (Vercel env)." },
        { status: 500 },
      );
    }
    if (
      message.includes("MYSQL_HOST") ||
      message.includes("MYSQL_PASSWORD") ||
      message.includes("MYSQL_DATABASE") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("Access denied")
    ) {
      return NextResponse.json(
        {
          error:
            "Greška konekcije na bazu. Proverite MYSQL_* env na Vercelu (Project, ne Shared).",
        },
        { status: 500 },
      );
    }
    if (message.includes("users") || message.includes("ER_NO_SUCH_TABLE")) {
      return NextResponse.json(
        {
          error:
            "Pogrešna baza (verovatno defaultdb umesto ponudaapp). Na Vercel dodaj PONUDEAPP_DATABASE=ponudaapp u Project env.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Prijava nije uspela" },
      { status: 500 },
    );
  }
}
