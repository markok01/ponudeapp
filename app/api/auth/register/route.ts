import { NextRequest } from "next/server";
import { AuthCodedError } from "@/lib/auth-error-codes";
import { authError } from "@/lib/authI18n";
import { PasswordPolicyError } from "@/lib/security/password-policy";
import { registerOrganizationOwner } from "@/services/auth-register";
import {
  establishUserSession,
  OrgSuspendedError,
} from "@/services/auth-session";
import { DeviceLimitError } from "@/services/user-sessions";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import {
  checkRateLimit,
  getSignupRateLimitConfig,
  recordRateLimitFailure,
} from "@/lib/security/rate-limit";
import { getRequestSecurityMeta } from "@/lib/security/request-context";

export async function POST(request: NextRequest) {
  const meta = getRequestSecurityMeta(request);
  const rateKey = meta.ipAddress ?? "unknown";
  const rateCfg = getSignupRateLimitConfig();

  try {
    const rate = await checkRateLimit("signup", rateKey, rateCfg);
    if (!rate.allowed) {
      await writeSecurityAuditLog({
        requestId: meta.requestId,
        eventType: "auth.signup.rate_limited",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        failureReason: "signup_rate_limit",
      });
      return authError(request, "signup_rate_limited", 429);
    }

    const body = await request.json();
    if (body.website || body._hp || body.url) {
      await recordRateLimitFailure("signup", rateKey, rateCfg);
      return authError(request, "forbidden", 400);
    }

    const password = String(body.password ?? "");
    const passwordConfirm = String(body.passwordConfirm ?? body.confirmPassword ?? "");
    if (password !== passwordConfirm) {
      await recordRateLimitFailure("signup", rateKey, rateCfg);
      return authError(request, "password_mismatch", 400);
    }

    const user = await registerOrganizationOwner({
      companyName: String(body.companyName ?? ""),
      personName: String(body.personName ?? body.name ?? ""),
      email: String(body.email ?? ""),
      password,
    });

    const response = await establishUserSession(request, user, true, "password");
    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "auth.signup.success",
      actorUserId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { provider: "password" },
    });
    return response;
  } catch (error) {
    await recordRateLimitFailure("signup", rateKey, rateCfg).catch(() => undefined);
    if (error instanceof OrgSuspendedError) {
      return authError(request, "org_suspended", 403);
    }
    if (error instanceof DeviceLimitError) {
      return authError(request, "device_limit", 403);
    }
    if (error instanceof PasswordPolicyError) {
      return authError(request, "password_policy", 400, { reasons: error.reasons });
    }
    if (error instanceof AuthCodedError) {
      return authError(request, error.code, 400);
    }
    console.error("POST /api/auth/register", error);
    return authError(request, "register_failed", 400);
  }
}
