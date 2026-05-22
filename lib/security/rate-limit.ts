import { createHash } from "crypto";
import { execute, query, type RowDataPacket } from "@/lib/db";

function keyHash(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

interface RateRow extends RowDataPacket {
  attempt_count: number;
  window_started_at: Date;
  locked_until: Date | null;
}

export interface RateLimitConfig {
  maxAttempts: number;
  windowSec: number;
  lockoutSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

export async function checkRateLimit(
  scope: string,
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const hash = keyHash(`${scope}:${identifier}`);
  const now = Date.now();

  const rows = await query<RateRow[]>(
    `SELECT attempt_count, window_started_at, locked_until
     FROM auth_rate_limits WHERE key_hash = ? LIMIT 1`,
    [hash],
  );

  const row = rows[0];
  if (row?.locked_until && new Date(row.locked_until).getTime() > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil(
        (new Date(row.locked_until).getTime() - now) / 1000,
      ),
    };
  }

  const windowMs = config.windowSec * 1000;
  let count = row?.attempt_count ?? 0;
  const windowStart = row?.window_started_at
    ? new Date(row.window_started_at).getTime()
    : 0;

  if (!row || now - windowStart > windowMs) {
    count = 0;
    await execute(
      `INSERT INTO auth_rate_limits (key_hash, attempt_count, window_started_at, locked_until)
       VALUES (?, 0, NOW(), NULL)
       ON DUPLICATE KEY UPDATE attempt_count = 0, window_started_at = NOW(), locked_until = NULL`,
      [hash],
    );
  }

  if (count >= config.maxAttempts) {
    const lockedUntil = new Date(now + config.lockoutSec * 1000);
    await execute(
      `UPDATE auth_rate_limits SET locked_until = ? WHERE key_hash = ?`,
      [lockedUntil, hash],
    );
    return { allowed: false, retryAfterSec: config.lockoutSec };
  }

  return { allowed: true };
}

export async function recordRateLimitFailure(
  scope: string,
  identifier: string,
  config: RateLimitConfig,
): Promise<void> {
  const hash = keyHash(`${scope}:${identifier}`);
  const windowMs = config.windowSec * 1000;
  const now = Date.now();

  const rows = await query<RateRow[]>(
    `SELECT attempt_count, window_started_at FROM auth_rate_limits WHERE key_hash = ? LIMIT 1`,
    [hash],
  );
  const row = rows[0];
  let count = 1;
  if (row) {
    const windowStart = new Date(row.window_started_at).getTime();
    count =
      now - windowStart > windowMs ? 1 : Number(row.attempt_count ?? 0) + 1;
  }

  const lockedUntil =
    count >= config.maxAttempts
      ? new Date(now + config.lockoutSec * 1000)
      : null;

  await execute(
    `INSERT INTO auth_rate_limits (key_hash, attempt_count, window_started_at, locked_until)
     VALUES (?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       attempt_count = VALUES(attempt_count),
       window_started_at = VALUES(window_started_at),
       locked_until = VALUES(locked_until)`,
    [hash, count, lockedUntil],
  );
}

export async function clearRateLimit(scope: string, identifier: string): Promise<void> {
  const hash = keyHash(`${scope}:${identifier}`);
  await execute(`DELETE FROM auth_rate_limits WHERE key_hash = ?`, [hash]);
}

export function getLoginRateLimitConfig(isAdminTarget: boolean): RateLimitConfig {
  if (isAdminTarget) {
    return {
      maxAttempts: Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS ?? 5),
      windowSec: Number(process.env.ADMIN_LOGIN_WINDOW_SEC ?? 900),
      lockoutSec: Number(process.env.ADMIN_LOGIN_LOCKOUT_SEC ?? 1800),
    };
  }
  return {
    maxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 10),
    windowSec: Number(process.env.LOGIN_WINDOW_SEC ?? 900),
    lockoutSec: Number(process.env.LOGIN_LOCKOUT_SEC ?? 900),
  };
}

export function getAdminCreateUserRateLimitConfig(): RateLimitConfig {
  return {
    maxAttempts: Number(process.env.ADMIN_CREATE_USER_MAX_PER_HOUR ?? 8),
    windowSec: 3600,
    lockoutSec: 3600,
  };
}
