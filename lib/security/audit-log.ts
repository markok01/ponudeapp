import { createHash } from "crypto";
import type { PoolConnection, RowDataPacket } from "@/lib/db";
import { withTransaction } from "@/lib/db";

export type SecurityAuditEvent =
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.login.rate_limited"
  | "auth.logout"
  | "auth.session.revoked_idle"
  | "admin.api.forbidden"
  | "admin.api.csrf_blocked"
  | "admin.api.access"
  | "admin.user.created"
  | "admin.user.deactivated"
  | "admin.user.deleted"
  | "admin.sessions.revoked"
  | "admin.suspicious"
  | "security.alert";

const AUDIT_LOCK_NAME = "ponudeapp_audit_chain";
const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export interface AuditLogInput {
  requestId: string;
  eventType: SecurityAuditEvent;
  /** Isto što i eventType — obavezno polje action u bazi */
  action?: SecurityAuditEvent;
  actorUserId?: number | null;
  targetUserId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  suspiciousFlag?: boolean;
}

interface HashRow extends RowDataPacket {
  entry_hash: string;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function buildCanonicalPayload(input: AuditLogInput, timestampIso: string): string {
  const action = input.action ?? input.eventType;
  return JSON.stringify({
    action,
    actorUserId: input.actorUserId ?? null,
    eventType: input.eventType,
    failureReason: input.failureReason ?? null,
    ipAddress: input.ipAddress ?? null,
    metadata: input.metadata ?? null,
    requestId: input.requestId,
    targetUserId: input.targetUserId ?? null,
    timestamp: timestampIso,
    userAgent: input.userAgent ?? null,
  });
}

function computeEntryHash(prevHash: string, canonical: string): string {
  return sha256Hex(`${prevHash}|${canonical}`);
}

async function getLock(conn: PoolConnection, timeoutSec = 10): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT GET_LOCK(?, ?) AS acquired`,
    [AUDIT_LOCK_NAME, timeoutSec],
  );
  return Number(rows[0]?.acquired) === 1;
}

async function releaseLock(conn: PoolConnection): Promise<void> {
  await conn.query(`SELECT RELEASE_LOCK(?)`, [AUDIT_LOCK_NAME]);
}

/**
 * Append-only audit sa hash lancem. Nema UPDATE/DELETE API-ja.
 * Koristi GET_LOCK radi race-safe lanca na serverless-u.
 */
export async function writeSecurityAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await withTransaction(async (conn) => {
      const locked = await getLock(conn);
      if (!locked) {
        console.error("security_audit_log: could not acquire chain lock");
        return;
      }

      try {
        const [lastRows] = await conn.query<HashRow[]>(
          `SELECT entry_hash FROM security_audit_log ORDER BY id DESC LIMIT 1`,
        );
        const prevHash = lastRows[0]?.entry_hash ?? GENESIS_HASH;
        const timestampIso = new Date().toISOString();
        const action = (input.action ?? input.eventType).slice(0, 64);
        const canonical = buildCanonicalPayload(input, timestampIso);
        const entryHash = computeEntryHash(prevHash, canonical);

        await conn.execute(
          `INSERT INTO security_audit_log (
            request_id, event_type, action, actor_user_id, target_user_id,
            ip_address, user_agent, failure_reason, metadata,
            prev_hash, entry_hash, suspicious_flag, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            input.requestId.slice(0, 64),
            input.eventType,
            action,
            input.actorUserId ?? null,
            input.targetUserId ?? null,
            input.ipAddress?.slice(0, 45) ?? null,
            input.userAgent?.slice(0, 512) ?? null,
            input.failureReason?.slice(0, 255) ?? null,
            input.metadata ? JSON.stringify(input.metadata) : null,
            prevHash,
            entryHash,
            input.suspiciousFlag ? 1 : 0,
          ],
        );
      } finally {
        await releaseLock(conn);
      }
    });
  } catch (error) {
    console.error("security_audit_log write failed", error);
  }
}

/** Verifikacija integriteta lanca (operativni alat / health). */
export async function verifyAuditChainSample(limit = 100): Promise<{
  ok: boolean;
  checked: number;
  brokenAtId?: number;
}> {
  const { query } = await import("@/lib/db");
  const rows = await query<
    (RowDataPacket & {
      id: number;
      prev_hash: string;
      entry_hash: string;
      request_id: string;
      action: string;
      event_type: string;
      actor_user_id: number | null;
      target_user_id: number | null;
      ip_address: string | null;
      user_agent: string | null;
      failure_reason: string | null;
      metadata: string | null;
      created_at: Date;
    })[]
  >(
    `SELECT id, prev_hash, entry_hash, request_id, event_type, action,
            actor_user_id, target_user_id, ip_address, user_agent,
            failure_reason, metadata, created_at
     FROM security_audit_log ORDER BY id ASC LIMIT ?`,
    [limit],
  );

  let prev = GENESIS_HASH;
  for (const row of rows) {
    if (row.prev_hash !== prev) {
      return { ok: false, checked: rows.length, brokenAtId: row.id };
    }
    const canonical = JSON.stringify({
      action: row.action,
      actorUserId: row.actor_user_id,
      eventType: row.event_type,
      failureReason: row.failure_reason,
      ipAddress: row.ip_address,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      requestId: row.request_id,
      targetUserId: row.target_user_id,
      timestamp: new Date(row.created_at).toISOString(),
      userAgent: row.user_agent,
    });
    const expected = computeEntryHash(row.prev_hash, canonical);
    if (expected !== row.entry_hash) {
      return { ok: false, checked: rows.length, brokenAtId: row.id };
    }
    prev = row.entry_hash;
  }
  return { ok: true, checked: rows.length };
}
