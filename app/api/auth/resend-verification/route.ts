import { NextRequest, NextResponse } from "next/server";
import { authError, authMessage, getRequestLocale } from "@/lib/authI18n";
import { resendVerificationByEmail } from "@/services/email-verification";
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
    const rate = await checkRateLimit("resend_verify", rateKey, rateCfg);
    if (!rate.allowed) {
      return authError(request, "resend_rate_limited", 429);
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return authError(request, "invalid_email", 400);
    }

    const locale = getRequestLocale(request);
    const result = await resendVerificationByEmail(email, request, locale);
    await recordRateLimitFailure("resend_verify", rateKey, rateCfg);

    if (result.cooldown) {
      return authError(request, "resend_cooldown", 429, {
        retryAfterSec: result.retryAfterSec,
      });
    }

    return NextResponse.json({
      ok: true,
      delivered: result.delivered === true,
      verifyUrl: result.verifyUrl,
      message: result.verifyUrl
        ? authMessage(request, "resend_dev_link")
        : authMessage(request, "resend_sent"),
    });
  } catch (error) {
    console.error("POST /api/auth/resend-verification", error);
    return authError(request, "resend_failed", 500);
  }
}
