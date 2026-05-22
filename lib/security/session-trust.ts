import { query, type RowDataPacket } from "@/lib/db";
import {
  computeTrustScore,
  type TrustScoreResult,
} from "@/lib/security/trust-score";
import {
  getKnownDevice,
  isStableIp,
  upsertKnownDeviceAfterLogin,
} from "@/services/known-devices";
import type { SessionClientInfo } from "@/lib/session-client-info";

interface CountRow extends RowDataPacket {
  cnt: number;
}

interface UserAgeRow extends RowDataPacket {
  created_at: Date;
}

async function countSuccessfulLogins(userId: number): Promise<number> {
  const rows = await query<CountRow[]>(
    `SELECT COUNT(*) AS cnt FROM security_audit_log
     WHERE actor_user_id = ? AND event_type = 'auth.login.success'`,
    [userId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

async function accountAgeDays(userId: number): Promise<number> {
  const rows = await query<UserAgeRow[]>(
    `SELECT created_at FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  if (!rows[0]) return 0;
  const ms = Date.now() - new Date(rows[0].created_at).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export async function buildTrustForLogin(input: {
  userId: number;
  deviceId: string;
  client: SessionClientInfo;
}): Promise<TrustScoreResult> {
  const prior = await getKnownDevice(input.userId, input.deviceId);
  const deviceInfo = await upsertKnownDeviceAfterLogin({
    userId: input.userId,
    deviceId: input.deviceId,
    deviceLabel: input.client.deviceLabel,
    ipAddress: input.client.ipAddress,
    countryCode: input.client.geoCountryCode,
  });

  const stableIp = isStableIp(
    input.client.ipAddress,
    prior?.last_ip ?? null,
  );

  const [successfulLoginsTotal, accountAgeDaysVal] = await Promise.all([
    countSuccessfulLogins(input.userId),
    accountAgeDays(input.userId),
  ]);

  return computeTrustScore({
    knownDevice: deviceInfo.knownDevice,
    deviceSuccessLogins: deviceInfo.deviceSuccessLogins,
    stableIp,
    accountAgeDays: accountAgeDaysVal,
    successfulLoginsTotal,
  });
}
