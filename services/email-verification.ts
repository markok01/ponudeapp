import { execute, query, type RowDataPacket } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { AuthCodedError } from "@/lib/auth-error-codes";
import {
  sendEmail,
  verificationEmailContent,
  type EmailLocale,
} from "@/lib/email";
import {
  generateRawSessionToken,
  hashSessionToken,
} from "@/lib/security/token-hash";
import { getUserByEmail, getUserById, markEmailVerified } from "@/services/users";
import type { NextRequest } from "next/server";

const VERIFY_HOURS = 48;
const RESEND_COOLDOWN_SEC = 60;

interface TokenRow extends RowDataPacket {
  id: number;
  user_id: number;
  expires_at: Date;
  created_at: Date;
}

export async function issueEmailVerificationToken(userId: number): Promise<string> {
  await execute(`DELETE FROM email_verification_tokens WHERE user_id = ?`, [userId]);
  const raw = generateRawSessionToken();
  const tokenHash = hashSessionToken(raw);
  await execute(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))`,
    [userId, tokenHash, VERIFY_HOURS],
  );
  return raw;
}

export async function secondsUntilResendAllowed(userId: number): Promise<number> {
  const rows = await query<TokenRow[]>(
    `SELECT created_at FROM email_verification_tokens
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const created = rows[0]?.created_at;
  if (!created) return 0;
  const elapsed = (Date.now() - new Date(created).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SEC - elapsed));
}

export async function sendVerificationEmailForUser(
  userId: number,
  request: NextRequest,
  locale: EmailLocale = "sr",
): Promise<{ delivered: boolean; logged: boolean; verifyUrl: string }> {
  const user = await getUserById(userId);
  if (!user) throw new Error("Nalog nije pronađen");
  if (user.email_verified_at) {
    throw new Error("Email je već potvrđen");
  }

  const wait = await secondsUntilResendAllowed(userId);
  if (wait > 0) {
    const err = new Error(`Sačekajte ${wait}s pre ponovnog slanja`);
    (err as Error & { code?: string; retryAfterSec?: number }).code = "cooldown";
    (err as Error & { retryAfterSec?: number }).retryAfterSec = wait;
    throw err;
  }

  const raw = await issueEmailVerificationToken(userId);
  const verifyUrl = `${getAppUrl(request)}/verify-email?token=${raw}`;
  const content = verificationEmailContent(verifyUrl, locale);
  const result = await sendEmail({
    to: user.email,
    ...content,
  });
  if (result.logged) {
    console.info(`[email] Verification link for ${user.email}: ${verifyUrl}`);
  }
  return { ...result, verifyUrl };
}

export async function verifyEmailToken(rawToken: string): Promise<{ email: string }> {
  const token = rawToken.trim();
  if (!token) throw new AuthCodedError("verify_token_missing");

  const tokenHash = hashSessionToken(token);
  const rows = await query<TokenRow[]>(
    `SELECT id, user_id, expires_at FROM email_verification_tokens
     WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) throw new AuthCodedError("verify_used");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await execute(`DELETE FROM email_verification_tokens WHERE id = ?`, [row.id]);
    throw new AuthCodedError("verify_expired");
  }

  const user = await getUserById(row.user_id);
  if (!user) throw new AuthCodedError("verify_failed");

  await markEmailVerified(user.id);
  await execute(`DELETE FROM email_verification_tokens WHERE user_id = ?`, [user.id]);
  return { email: user.email };
}

export async function resendVerificationByEmail(
  email: string,
  request: NextRequest,
  locale: EmailLocale = "sr",
): Promise<{
  ok: true;
  cooldown?: boolean;
  retryAfterSec?: number;
  delivered?: boolean;
  verifyUrl?: string;
}> {
  const user = await getUserByEmail(email.trim().toLowerCase());
  if (!user || user.email_verified_at) {
    return { ok: true };
  }
  try {
    const sent = await sendVerificationEmailForUser(user.id, request, locale);
    return {
      ok: true,
      delivered: sent.delivered,
      verifyUrl: sent.delivered ? undefined : sent.verifyUrl,
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "cooldown") {
      return {
        ok: true,
        cooldown: true,
        retryAfterSec: (error as { retryAfterSec?: number }).retryAfterSec,
      };
    }
    throw error;
  }
}
