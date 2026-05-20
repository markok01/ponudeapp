import { query, execute, type RowDataPacket } from "@/lib/db";
import type { AppSettings } from "@/types";

const KEYS = {
  companyName: "company_name",
  logoDataUrl: "logo_data_url",
} as const;

export async function getAppSettingsFromDb(): Promise<AppSettings> {
  const rows = await query<RowDataPacket[]>(
    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (?, ?)`,
    [KEYS.companyName, KEYS.logoDataUrl],
  );

  const map = new Map(rows.map((r) => [r.setting_key as string, r.setting_value as string]));

  return {
    companyName: map.get(KEYS.companyName) ?? "",
    logoDataUrl: map.get(KEYS.logoDataUrl) ?? null,
  };
}

export async function saveAppSettingsToDb(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettingsFromDb();
  const next: AppSettings = {
    companyName: patch.companyName !== undefined ? patch.companyName : current.companyName,
    logoDataUrl: patch.logoDataUrl !== undefined ? patch.logoDataUrl : current.logoDataUrl,
  };

  await execute(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [KEYS.companyName, next.companyName],
  );

  await execute(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [KEYS.logoDataUrl, next.logoDataUrl ?? ""],
  );

  return next;
}
