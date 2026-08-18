import { query, execute, type RowDataPacket } from "@/lib/db";
import { defaultCurrencyForLocale, normalizeCurrency } from "@/lib/currency";
import { normalizeLocale } from "@/lib/i18n/types";
import type { AppSettings } from "@/types";

const KEYS = {
  companyName: "company_name",
  logoDataUrl: "logo_data_url",
  locale: "locale",
  currency: "currency",
} as const;

export async function getAppSettingsFromDb(organizationId: number): Promise<AppSettings> {
  const rows = await query<RowDataPacket[]>(
    `SELECT setting_key, setting_value FROM org_settings
     WHERE organization_id = ? AND setting_key IN (?, ?, ?, ?)`,
    [organizationId, KEYS.companyName, KEYS.logoDataUrl, KEYS.locale, KEYS.currency],
  );

  const map = new Map(rows.map((r) => [r.setting_key as string, r.setting_value as string]));
  const locale = normalizeLocale(map.get(KEYS.locale));
  const storedCurrency = map.get(KEYS.currency);

  return {
    companyName: map.get(KEYS.companyName) ?? "",
    logoDataUrl: map.get(KEYS.logoDataUrl) ?? null,
    locale,
    currency: storedCurrency
      ? normalizeCurrency(storedCurrency)
      : defaultCurrencyForLocale(locale),
  };
}

export async function saveAppSettingsToDb(
  organizationId: number,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = await getAppSettingsFromDb(organizationId);
  const next: AppSettings = {
    companyName: patch.companyName !== undefined ? patch.companyName : current.companyName,
    logoDataUrl: patch.logoDataUrl !== undefined ? patch.logoDataUrl : current.logoDataUrl,
    locale: patch.locale !== undefined ? normalizeLocale(patch.locale) : current.locale,
    currency:
      patch.currency !== undefined ? normalizeCurrency(patch.currency) : current.currency,
  };

  await execute(
    `INSERT INTO org_settings (organization_id, setting_key, setting_value) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [organizationId, KEYS.companyName, next.companyName],
  );

  await execute(
    `INSERT INTO org_settings (organization_id, setting_key, setting_value) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [organizationId, KEYS.logoDataUrl, next.logoDataUrl ?? ""],
  );

  await execute(
    `INSERT INTO org_settings (organization_id, setting_key, setting_value) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [organizationId, KEYS.locale, next.locale],
  );

  if (patch.currency !== undefined) {
    await execute(
      `INSERT INTO org_settings (organization_id, setting_key, setting_value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [organizationId, KEYS.currency, next.currency],
    );
  }

  return next;
}
