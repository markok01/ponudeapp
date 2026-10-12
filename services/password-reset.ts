import type { NextRequest } from "next/server";
import { execute, query, type RowDataPacket } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { hashPassword } from "@/lib/password";
import {
  passwordResetEmailContent,
  sendEmail,
  type EmailLocale,
} from "@/lib/email";
import { generateRawSessionToken, hashSessionToken } from "@/lib/security/token-hash";
import { bumpUserSecurityVersion, getUserByEmail } from "@/services/users";

const RESET_HOURS = 1;

interface TokenRow extends RowDataPacket {
  user_id: number;
}

export async function requestPasswordReset(
  email: string,
  request: NextRequest,
  locale: EmailLocale = "sr",
): Promise<void> {
  const user = await getUserByEmail(email);
  if (!user || !user.active) return;

  await execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [user.id]);
  const raw = generateRawSessionToken();
  const tokenHash = hashSessionToken(raw);
  await execute(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))`,
    [user.id, tokenHash, RESET_HOURS],
  );

  const url = `${getAppUrl(request)}/reset-password?token=${raw}`;
  const content = passwordResetEmailContent(url, locale);
  const result = await sendEmail({ to: user.email, ...content });
  if (result.logged) {
    console.info(`[email] Password reset for ${user.email}: ${url}`);
  }
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<void> {
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    throw new Error("Lozinka mora imati najmanje 8 karaktera");
  }
  const tokenHash = hashSessionToken(token.trim());
  const rows = await query<TokenRow[]>(
    `SELECT user_id FROM password_reset_tokens
     WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash],
  );
  const userId = rows[0]?.user_id;
  if (!userId) {
    throw new Error("Link za novu lozinku je nevažeći ili je istekao");
  }

  const passwordHash = await hashPassword(trimmed);
  await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
  await execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [userId]);
  await bumpUserSecurityVersion(userId);
}
