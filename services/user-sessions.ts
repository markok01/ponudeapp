import { randomUUID } from "crypto";
import { execute, query, type RowDataPacket } from "@/lib/db";
import type { SessionClientInfo } from "@/lib/session-client-info";
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
}

export interface UserLoginSummary {
  userId: number;
  email: string;
  name: string;
  role: UserRole;
  activeSessionCount: number;
  /** null = admin, neograničeno uređaja */
  maxDevices: number | null;
  sessions: ActiveSessionDetail[];
}

export function getMaxDevices(): number {
  const raw = process.env.MAX_DEVICES?.trim();
  const n = raw ? Number(raw) : 2;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
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

interface SessionRow extends RowDataPacket {
  id: string;
  user_id: number;
  expires_at: Date;
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
): Promise<string> {
  await assertCanCreateSession(userId);

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);

  await execute(
    `INSERT INTO user_sessions (
      id, user_id, expires_at,
      device_label, user_agent, ip_address,
      geo_city, geo_country, geo_country_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      expiresAt,
      client?.deviceLabel ?? null,
      client?.userAgent ?? null,
      client?.ipAddress ?? null,
      client?.geoCity ?? null,
      client?.geoCountry ?? null,
      client?.geoCountryCode ?? null,
    ],
  );

  return id;
}

export async function touchUserSession(sessionId: string): Promise<void> {
  await execute(
    `UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ? AND expires_at >= NOW()`,
    [sessionId],
  );
}

export async function getValidUserSession(
  sessionId: string,
  userId: number,
): Promise<boolean> {
  await purgeExpiredSessions();
  const rows = await query<SessionRow[]>(
    `SELECT id FROM user_sessions
     WHERE id = ? AND user_id = ? AND expires_at >= NOW()
     LIMIT 1`,
    [sessionId, userId],
  );
  return rows.length > 0;
}

export async function revokeUserSession(sessionId: string): Promise<void> {
  await execute(`DELETE FROM user_sessions WHERE id = ?`, [sessionId]);
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
  await execute(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
}

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
}

/** Pregled aktivnih prijava za admin panel (Podešavanja). */
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
      s.geo_country_code
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.expires_at >= NOW() AND u.active = 1
    ORDER BY s.last_seen_at DESC
  `);

  const maxRegular = getMaxDevices();
  const byUser = new Map<number, UserLoginSummary>();

  for (const row of rows) {
    const role: UserRole = row.role === "admin" ? "admin" : "user";
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
