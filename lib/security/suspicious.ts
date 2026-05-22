import { query, type RowDataPacket } from "@/lib/db";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { getKnownDevice } from "@/services/known-devices";

interface CountRow extends RowDataPacket {
  cnt: number;
}

interface LoginGeoRow extends RowDataPacket {
  geo_country_code: string | null;
  created_at: Date;
}

export interface SuspiciousAlert {
  alert: boolean;
  reasons: string[];
}

export async function countFailedLogins10Min(
  ipAddress: string | null,
): Promise<number> {
  if (!ipAddress) return 0;
  const rows = await query<CountRow[]>(
    `SELECT COUNT(*) AS cnt FROM security_audit_log
     WHERE ip_address = ? AND event_type = 'auth.login.failed'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)`,
    [ipAddress],
  );
  return Number(rows[0]?.cnt ?? 0);
}

/** Login iz nove države <10 min od prethodnog uspešnog logina istog korisnika. */
export async function detectNewCountryRapidLogin(
  userId: number,
  countryCode: string | null,
): Promise<boolean> {
  if (!countryCode) return false;

  const rows = await query<LoginGeoRow[]>(
    `SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.countryCode')) AS geo_country_code,
            created_at
     FROM security_audit_log
     WHERE actor_user_id = ? AND event_type = 'auth.login.success'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );

  const prev = rows[0]?.geo_country_code?.trim().toUpperCase();
  if (!prev || prev === countryCode.toUpperCase()) return false;
  return true;
}

export async function countUserSessionsLastMinute(userId: number): Promise<number> {
  const rows = await query<CountRow[]>(
    `SELECT COUNT(*) AS cnt FROM user_sessions
     WHERE user_id = ? AND session_created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
    [userId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

/** Admin mutacija sa nepoznatog uređaja ili drugačijeg IP opsega. */
export async function detectAdminNewDeviceOrIp(
  adminUserId: number,
  deviceId: string | null,
  ipAddress: string | null,
): Promise<boolean> {
  if (!deviceId) return true;

  const known = await getKnownDevice(adminUserId, deviceId);
  if (!known) return true;

  if (!ipAddress || !known.last_ip) return false;

  const same24 =
    ipAddress.split(".").slice(0, 3).join(".") ===
    known.last_ip.split(".").slice(0, 3).join(".");
  return !same24 && ipAddress !== known.last_ip;
}

export async function evaluateLoginSuspicious(input: {
  requestId: string;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  countryCode: string | null;
}): Promise<SuspiciousAlert> {
  const reasons: string[] = [];

  const failed = await countFailedLogins10Min(input.ipAddress);
  if (failed > 5) reasons.push("failed_login_burst_10min");

  if (input.userId > 0) {
    if (await detectNewCountryRapidLogin(input.userId, input.countryCode)) {
      reasons.push("new_country_within_10min");
    }
    const sessionBurst = await countUserSessionsLastMinute(input.userId);
    if (sessionBurst > 3) reasons.push("session_burst_1min");
  }

  return { alert: reasons.length > 0, reasons };
}

export async function evaluateAdminActionSuspicious(input: {
  requestId: string;
  adminUserId: number;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  pathname: string;
  method: string;
}): Promise<SuspiciousAlert> {
  const reasons: string[] = [];

  const failed = await countFailedLogins10Min(input.ipAddress);
  if (failed > 5) reasons.push("failed_login_burst_10min");

  if (
    await detectAdminNewDeviceOrIp(
      input.adminUserId,
      input.deviceId,
      input.ipAddress,
    )
  ) {
    reasons.push("admin_new_device_or_ip");
  }

  const sessionBurst = await countUserSessionsLastMinute(input.adminUserId);
  if (sessionBurst > 3) reasons.push("session_burst_1min");

  if (input.method !== "GET") {
    const apiRows = await query<CountRow[]>(
      `SELECT COUNT(*) AS cnt FROM security_audit_log
       WHERE actor_user_id = ? AND action IN ('admin.api.access', 'admin.user.created', 'admin.user.deactivated', 'admin.user.deleted', 'admin.sessions.revoked')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
      [input.adminUserId],
    );
    if (Number(apiRows[0]?.cnt ?? 0) > 15) {
      reasons.push("admin_mutation_burst");
    }
  }

  return { alert: reasons.length > 0, reasons };
}

export async function recordSuspiciousAlert(input: {
  requestId: string;
  actorUserId?: number | null;
  targetUserId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  reasons: string[];
  context?: Record<string, unknown>;
}): Promise<void> {
  if (input.reasons.length === 0) return;

  await writeSecurityAuditLog({
    requestId: input.requestId,
    eventType: "security.alert",
    action: "security.alert",
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    failureReason: input.reasons.join(","),
    metadata: { reasons: input.reasons, ...input.context },
    suspiciousFlag: true,
  });
}
