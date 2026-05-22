import { execute, query, type RowDataPacket } from "@/lib/db";
import type { SessionClientInfo } from "@/lib/session-client-info";
import {
  atomicDeactivateUserSessions,
  atomicRevokeAllUserSessions,
  atomicRevokeUserSession,
} from "@/lib/security/session-revoke";
import {
  generateRawSessionToken,
  hashSessionToken,
  isLegacySessionId,
  newSessionRowId,
} from "@/lib/security/token-hash";
import type { TrustLevel } from "@/lib/security/trust-score";
import type { UserRole } from "@/services/users";

interface UserRoleRow extends RowDataPacket {
  role: string;
}

export interface ActiveSessionDetail {
  sessionId: string;
  userId: number;
  email: string;
  name: string;
  role: UserRole;
  lastSeenAt: string;
  expiresAt: string;
  deviceLabel: string | null;
  geoCity: string | null;
  geoCountry: string | null;
  geoCountryCode: string | null;
  trustScore: number;
  trustLevel: TrustLevel;
  deviceId: string | null;
}

export interface UserLoginSummary {
  userId: number;
  email: string;
  name: string;
  role: UserRole;
  activeSessionCount: number;
  maxDevices: number | null;
  sessions: ActiveSessionDetail[];
}

export interface ResolvedSession {
  rowId: string;
  userId: number;
  lastActivityAt: Date;
  sessionCreatedAt: Date;
  trustScore: number;
  trustLevel: TrustLevel;
  deviceId: string | null;
}

export function getMaxDevices(): number {
  const raw = process.env.MAX_DEVICES?.trim();
  const n = raw ? Number(raw) : 2;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

export function getAdminCreateUserCooldownMs(): number {
  const raw = process.env.ADMIN_CREATE_USER_COOLDOWN_SEC?.trim();
  const sec = raw ? Number(raw) : 60;
  return (Number.isFinite(sec) && sec > 0 ? sec : 60) * 1000;
}

export class DeviceLimitError extends Error {
  readonly code = "device_limit" as const;

  constructor(maxDevices: number) {
    super(
      `Ovaj nalog je već prijavljen na maksimalno ${maxDevices} uređaja. Odjavite se na jednom od njih pa pokušajte ponovo.`,
    );
    this.name = "DeviceLimitError";
  }
}

interface SessionLookupRow extends RowDataPacket {
  id: string;
  user_id: number;
  last_activity_at: Date;
  session_created_at: Date;
  trust_score: number;
  trust_level: string;
  device_id: string | null;
}

export async function purgeExpiredSessions(): Promise<void> {
  await execute(`DELETE FROM user_sessions WHERE expires_at < NOW()`);
}

export async function countActiveSessions(userId: number): Promise<number> {
  await purgeExpiredSessions();
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM user_sessions WHERE user_id = ? AND expires_at >= NOW()`,
    [userId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

async function isAdminUser(userId: number): Promise<boolean> {
  const rows = await query<UserRoleRow[]>(
    `SELECT role FROM users WHERE id = ? AND active = 1 LIMIT 1`,
    [userId],
  );
  return rows[0]?.role === "admin";
}

export async function assertCanCreateSession(userId: number): Promise<void> {
  if (await isAdminUser(userId)) return;

  const max = getMaxDevices();
  const active = await countActiveSessions(userId);
  if (active >= max) {
    throw new DeviceLimitError(max);
  }
}

export async function createUserSession(
  userId: number,
  maxAgeSec: number,
  client?: SessionClientInfo,
  options?: {
    deviceId: string;
    trustScore: number;
    trustLevel: TrustLevel;
  },
): Promise<string> {
  await assertCanCreateSession(userId);

  const rowId = newSessionRowId();
  const rawToken = generateRawSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);
  const trustScore = options?.trustScore ?? 0;
  const trustLevel = options?.trustLevel ?? "low";
  const deviceId = options?.deviceId ?? null;

  await execute(
    `INSERT INTO user_sessions (
      id, token_hash, user_id, expires_at,
      device_label, user_agent, ip_address,
      geo_city, geo_country, geo_country_code,
      device_id, trust_score, trust_level,
      last_seen_at, last_activity_at, session_created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      rowId,
      tokenHash,
      userId,
      expiresAt,
      client?.deviceLabel ?? null,
      client?.userAgent ?? null,
      client?.ipAddress ?? null,
      client?.geoCity ?? null,
      client?.geoCountry ?? null,
      client?.geoCountryCode ?? null,
      deviceId,
      trustScore,
      trustLevel,
    ],
  );

  return rawToken;
}

function mapResolved(row: SessionLookupRow): ResolvedSession {
  const level = row.trust_level as TrustLevel;
  return {
    rowId: row.id,
    userId: row.user_id,
    lastActivityAt: new Date(row.last_activity_at),
    sessionCreatedAt: new Date(row.session_created_at),
    trustScore: Number(row.trust_score ?? 0),
    trustLevel:
      level === "high" || level === "medium" || level === "low" ? level : "low",
    deviceId: row.device_id?.trim() || null,
  };
}

export async function resolveUserSession(
  rawSid: string,
  userId: number,
): Promise<ResolvedSession | null> {
  await purgeExpiredSessions();

  const tokenHash = hashSessionToken(rawSid);
  let rows = await query<SessionLookupRow[]>(
    `SELECT id, user_id, last_activity_at, session_created_at,
            trust_score, trust_level, device_id
     FROM user_sessions
     WHERE token_hash = ? AND user_id = ? AND expires_at >= NOW()
     LIMIT 1`,
    [tokenHash, userId],
  );

  if (!rows[0] && isLegacySessionId(rawSid)) {
    rows = await query<SessionLookupRow[]>(
      `SELECT id, user_id, last_activity_at, session_created_at,
              trust_score, trust_level, device_id
       FROM user_sessions
       WHERE id = ? AND user_id = ? AND expires_at >= NOW()
       LIMIT 1`,
      [rawSid, userId],
    );
  }

  if (!rows[0]) return null;
  return mapResolved(rows[0]);
}

export async function touchUserSession(rawSid: string): Promise<void> {
  const tokenHash = hashSessionToken(rawSid);
  const result = await execute(
    `UPDATE user_sessions
     SET last_seen_at = NOW(), last_activity_at = NOW()
     WHERE token_hash = ? AND expires_at >= NOW()`,
    [tokenHash],
  );
  if ((result.affectedRows ?? 0) > 0) return;

  if (isLegacySessionId(rawSid)) {
    await execute(
      `UPDATE user_sessions
       SET last_seen_at = NOW(), last_activity_at = NOW()
       WHERE id = ? AND expires_at >= NOW()`,
      [rawSid],
    );
  }
}

export async function getValidUserSession(
  rawSid: string,
  userId: number,
): Promise<boolean> {
  return (await resolveUserSession(rawSid, userId)) !== null;
}

export async function assertAdminCreateUserCooldown(
  rawSid: string,
  userId: number,
): Promise<void> {
  const resolved = await resolveUserSession(rawSid, userId);
  if (!resolved) {
    throw new Error("Sesija nije validna");
  }
  const elapsed = Date.now() - resolved.sessionCreatedAt.getTime();
  if (elapsed < getAdminCreateUserCooldownMs()) {
    const waitSec = Math.ceil(
      (getAdminCreateUserCooldownMs() - elapsed) / 1000,
    );
    throw new Error(
      `Sačekajte ${waitSec}s pre dodavanja novog korisnika (zaštita od automatskih napada).`,
    );
  }
}

export async function revokeUserSession(rawSid: string): Promise<void> {
  await atomicRevokeUserSession(rawSid);
}

export async function revokeAllUserSessions(
  userId: number,
  options?: { bumpSessionVersion?: boolean },
): Promise<void> {
  await atomicRevokeAllUserSessions(userId, options);
}

export { atomicDeactivateUserSessions } from "@/lib/security/session-revoke";

interface SessionDetailRow extends RowDataPacket {
  session_id: string;
  user_id: number;
  email: string;
  name: string;
  role: string;
  last_seen_at: Date;
  expires_at: Date;
  device_label: string | null;
  geo_city: string | null;
  geo_country: string | null;
  geo_country_code: string | null;
  trust_score: number;
  trust_level: string;
  device_id: string | null;
}

export async function listUserLoginSummaries(): Promise<UserLoginSummary[]> {
  await purgeExpiredSessions();

  const rows = await query<SessionDetailRow[]>(`
    SELECT
      s.id AS session_id,
      s.user_id,
      u.email,
      u.name,
      u.role,
      s.last_seen_at,
      s.expires_at,
      s.device_label,
      s.geo_city,
      s.geo_country,
      s.geo_country_code,
      s.trust_score,
      s.trust_level,
      s.device_id
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.expires_at >= NOW() AND u.active = 1
    ORDER BY s.last_seen_at DESC
  `);

  const maxRegular = getMaxDevices();
  const byUser = new Map<number, UserLoginSummary>();

  for (const row of rows) {
    const role: UserRole = row.role === "admin" ? "admin" : "user";
    const trustLevel = row.trust_level as TrustLevel;
    let entry = byUser.get(row.user_id);
    if (!entry) {
      entry = {
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role,
        activeSessionCount: 0,
        maxDevices: role === "admin" ? null : maxRegular,
        sessions: [],
      };
      byUser.set(row.user_id, entry);
    }
    entry.activeSessionCount += 1;
    entry.sessions.push({
      sessionId: row.session_id,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      role,
      lastSeenAt: new Date(row.last_seen_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      deviceLabel: row.device_label?.trim() || null,
      geoCity: row.geo_city?.trim() || null,
      geoCountry: row.geo_country?.trim() || null,
      geoCountryCode: row.geo_country_code?.trim() || null,
      trustScore: Number(row.trust_score ?? 0),
      trustLevel:
        trustLevel === "high" || trustLevel === "medium" || trustLevel === "low"
          ? trustLevel
          : "low",
      deviceId: row.device_id?.trim() || null,
    });
  }

  const allUsers = await query<
    (RowDataPacket & { id: number; email: string; name: string; role: string })[]
  >(`SELECT id, email, name, role FROM users WHERE active = 1 ORDER BY email ASC`);

  const result: UserLoginSummary[] = [];
  for (const u of allUsers) {
    const role: UserRole = u.role === "admin" ? "admin" : "user";
    const existing = byUser.get(u.id);
    if (existing) {
      result.push(existing);
    } else {
      result.push({
        userId: u.id,
        email: u.email,
        name: u.name,
        role,
        activeSessionCount: 0,
        maxDevices: role === "admin" ? null : maxRegular,
        sessions: [],
      });
    }
  }

  return result.sort((a, b) => {
    if (b.activeSessionCount !== a.activeSessionCount) {
      return b.activeSessionCount - a.activeSessionCount;
    }
    return a.email.localeCompare(b.email);
  });
}
