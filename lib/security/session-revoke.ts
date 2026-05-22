import {
  withTransaction,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "@/lib/db";
import { hashSessionToken, isLegacySessionId } from "@/lib/security/token-hash";

type SqlParams = (string | number | boolean | null | Date)[];

async function execConn(
  conn: PoolConnection,
  sql: string,
  params?: SqlParams,
): Promise<ResultSetHeader> {
  const [result] = await conn.execute<ResultSetHeader>(sql, params);
  return result;
}

async function queryConn<T extends RowDataPacket[]>(
  conn: PoolConnection,
  sql: string,
  params?: SqlParams,
): Promise<T> {
  const [rows] = await conn.query<T>(sql, params);
  return rows;
}

/** Atomski briše jednu sesiju (token hash ili legacy id). */
export async function atomicRevokeUserSession(rawSid: string): Promise<boolean> {
  return withTransaction(async (conn) => {
    const tokenHash = hashSessionToken(rawSid);
    let result = await execConn(
      conn,
      `DELETE FROM user_sessions WHERE token_hash = ?`,
      [tokenHash],
    );
    if ((result.affectedRows ?? 0) > 0) return true;

    if (isLegacySessionId(rawSid)) {
      result = await execConn(
        conn,
        `DELETE FROM user_sessions WHERE id = ?`,
        [rawSid],
      );
      return (result.affectedRows ?? 0) > 0;
    }
    return false;
  });
}

/** Atomski briše sve sesije korisnika; opciono bump session_version. */
export async function atomicRevokeAllUserSessions(
  userId: number,
  options?: { bumpSessionVersion?: boolean },
): Promise<void> {
  const bump = options?.bumpSessionVersion ?? false;

  await withTransaction(async (conn) => {
    await queryConn<RowDataPacket[]>(
      conn,
      `SELECT id FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    await execConn(conn, `DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
    if (bump) {
      await execConn(
        conn,
        `UPDATE users SET session_version = session_version + 1 WHERE id = ?`,
        [userId],
      );
    }
  });
}

/** Promena uloge + invalidacija svih sesija u jednoj transakciji. */
export async function atomicInvalidateSessionsOnRoleChange(
  userId: number,
  newRole: "admin" | "user",
): Promise<void> {
  await withTransaction(async (conn) => {
    await queryConn<RowDataPacket[]>(
      conn,
      `SELECT id FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    await execConn(conn, `UPDATE users SET role = ? WHERE id = ?`, [
      newRole,
      userId,
    ]);
    await execConn(conn, `DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
    await execConn(
      conn,
      `UPDATE users SET session_version = session_version + 1 WHERE id = ?`,
      [userId],
    );
  });
}

/** Deaktivacija naloga + sesije atomski. */
export async function atomicDeactivateUserSessions(userId: number): Promise<void> {
  await withTransaction(async (conn) => {
    await queryConn<RowDataPacket[]>(
      conn,
      `SELECT id FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    await execConn(conn, `DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
    await execConn(
      conn,
      `UPDATE users SET active = 0, session_version = session_version + 1 WHERE id = ?`,
      [userId],
    );
  });
}
