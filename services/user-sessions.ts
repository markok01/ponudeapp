import { randomUUID } from "crypto";
import { execute, query, type RowDataPacket } from "@/lib/db";

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

export async function assertCanCreateSession(userId: number): Promise<void> {
  const max = getMaxDevices();
  const active = await countActiveSessions(userId);
  if (active >= max) {
    throw new DeviceLimitError(max);
  }
}

export async function createUserSession(
  userId: number,
  maxAgeSec: number,
): Promise<string> {
  await assertCanCreateSession(userId);

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);

  await execute(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
    [id, userId, expiresAt],
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
