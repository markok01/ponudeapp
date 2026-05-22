import { execute, query, type RowDataPacket } from "@/lib/db";
import { ipNetworkPrefix } from "@/lib/security/trust-score";

interface KnownDeviceRow extends RowDataPacket {
  device_id: string;
  success_login_count: number;
  last_ip: string | null;
  last_country_code: string | null;
}

export async function getKnownDevice(
  userId: number,
  deviceId: string,
): Promise<KnownDeviceRow | null> {
  const rows = await query<KnownDeviceRow[]>(
    `SELECT device_id, success_login_count, last_ip, last_country_code
     FROM user_known_devices WHERE user_id = ? AND device_id = ? LIMIT 1`,
    [userId, deviceId],
  );
  return rows[0] ?? null;
}

export async function upsertKnownDeviceAfterLogin(input: {
  userId: number;
  deviceId: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  countryCode: string | null;
}): Promise<{ knownDevice: boolean; deviceSuccessLogins: number }> {
  const existing = await getKnownDevice(input.userId, input.deviceId);
  const knownDevice = Boolean(existing);

  await execute(
    `INSERT INTO user_known_devices (
      user_id, device_id, device_label, last_ip, last_country_code,
      success_login_count, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      device_label = COALESCE(VALUES(device_label), device_label),
      last_ip = VALUES(last_ip),
      last_country_code = VALUES(last_country_code),
      success_login_count = success_login_count + 1,
      last_seen_at = NOW()`,
    [
      input.userId,
      input.deviceId,
      input.deviceLabel,
      input.ipAddress,
      input.countryCode,
    ],
  );

  const updated = await getKnownDevice(input.userId, input.deviceId);
  return {
    knownDevice: knownDevice || Boolean(updated),
    deviceSuccessLogins: Number(updated?.success_login_count ?? 1),
  };
}

export function isStableIp(
  currentIp: string | null,
  lastIp: string | null,
): boolean {
  if (!currentIp || !lastIp) return false;
  if (currentIp === lastIp) return true;
  const a = ipNetworkPrefix(currentIp);
  const b = ipNetworkPrefix(lastIp);
  return Boolean(a && b && a === b);
}
