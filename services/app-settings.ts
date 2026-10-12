import { query, execute, type RowDataPacket } from "@/lib/db";
import { defaultCurrencyForLocale, normalizeCurrency } from "@/lib/currency";
import {
  CATALOG_THEME_DEFAULT,
  isCatalogThemePreset,
  normalizeCatalogColors,
} from "@/lib/catalog-theme";
import { normalizeLocale } from "@/lib/i18n/types";
import type { AppSettings, CatalogColorPalette, CatalogThemePreset } from "@/types";

const KEYS = {
  companyName: "company_name",
  logoDataUrl: "logo_data_url",
  taxId: "tax_id",
  address: "address",
  phone: "phone",
  bankAccount: "bank_account",
  stampDataUrl: "stamp_data_url",
  membersCanLockQuotes: "members_can_lock_quotes",
  locale: "locale",
  currency: "currency",
  catalogThemePreset: "catalog_theme_preset",
  catalogColors: "catalog_colors",
} as const;

const PROFILE_KEYS = [
  KEYS.companyName,
  KEYS.logoDataUrl,
  KEYS.taxId,
  KEYS.address,
  KEYS.phone,
  KEYS.bankAccount,
  KEYS.stampDataUrl,
  KEYS.membersCanLockQuotes,
  KEYS.locale,
  KEYS.currency,
  KEYS.catalogThemePreset,
  KEYS.catalogColors,
] as const;

function parseStoredTheme(
  presetRaw: string | undefined,
  colorsRaw: string | undefined,
): { catalogThemePreset: CatalogThemePreset; catalogColors: CatalogColorPalette } {
  const catalogThemePreset = isCatalogThemePreset(presetRaw) ? presetRaw : "default";
  let parsedColors: Partial<CatalogColorPalette> | undefined;
  if (colorsRaw) {
    try {
      parsedColors = JSON.parse(colorsRaw) as Partial<CatalogColorPalette>;
    } catch {
      parsedColors = undefined;
    }
  }
  return {
    catalogThemePreset,
    catalogColors: normalizeCatalogColors(parsedColors, CATALOG_THEME_DEFAULT),
  };
}

export async function getAppSettingsFromDb(organizationId: number): Promise<AppSettings> {
  const rows = await query<RowDataPacket[]>(
    `SELECT setting_key, setting_value FROM org_settings
     WHERE organization_id = ? AND setting_key IN (${PROFILE_KEYS.map(() => "?").join(", ")})`,
    [organizationId, ...PROFILE_KEYS],
  );

  const map = new Map(rows.map((r) => [r.setting_key as string, r.setting_value as string]));
  const locale = normalizeLocale(map.get(KEYS.locale));
  const storedCurrency = map.get(KEYS.currency);
  const theme = parseStoredTheme(
    map.get(KEYS.catalogThemePreset),
    map.get(KEYS.catalogColors),
  );

  const stamp = map.get(KEYS.stampDataUrl) ?? "";
  return {
    companyName: map.get(KEYS.companyName) ?? "",
    logoDataUrl: map.get(KEYS.logoDataUrl) || null,
    taxId: map.get(KEYS.taxId) ?? "",
    address: map.get(KEYS.address) ?? "",
    phone: map.get(KEYS.phone) ?? "",
    bankAccount: map.get(KEYS.bankAccount) ?? "",
    stampDataUrl: stamp || null,
    membersCanLockQuotes: map.get(KEYS.membersCanLockQuotes) === "1",
    locale,
    currency: storedCurrency
      ? normalizeCurrency(storedCurrency)
      : defaultCurrencyForLocale(locale),
    ...theme,
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
    taxId: patch.taxId !== undefined ? patch.taxId.trim() : current.taxId,
    address: patch.address !== undefined ? patch.address.trim() : current.address,
    phone: patch.phone !== undefined ? patch.phone.trim() : current.phone,
    bankAccount: patch.bankAccount !== undefined ? patch.bankAccount.trim() : current.bankAccount,
    stampDataUrl: patch.stampDataUrl !== undefined ? patch.stampDataUrl : current.stampDataUrl,
    membersCanLockQuotes:
      patch.membersCanLockQuotes !== undefined
        ? patch.membersCanLockQuotes
        : current.membersCanLockQuotes,
    locale: patch.locale !== undefined ? normalizeLocale(patch.locale) : current.locale,
    currency:
      patch.currency !== undefined ? normalizeCurrency(patch.currency) : current.currency,
    catalogThemePreset: isCatalogThemePreset(patch.catalogThemePreset)
      ? patch.catalogThemePreset
      : current.catalogThemePreset,
    catalogColors: normalizeCatalogColors(
      patch.catalogColors ?? current.catalogColors,
      CATALOG_THEME_DEFAULT,
    ),
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

  const rows: [string, string][] = [
    [KEYS.taxId, next.taxId],
    [KEYS.address, next.address],
    [KEYS.phone, next.phone],
    [KEYS.bankAccount, next.bankAccount],
    [KEYS.stampDataUrl, next.stampDataUrl ?? ""],
    [KEYS.membersCanLockQuotes, next.membersCanLockQuotes ? "1" : "0"],
    [KEYS.locale, next.locale],
    [KEYS.catalogThemePreset, next.catalogThemePreset],
    [KEYS.catalogColors, JSON.stringify(next.catalogColors)],
  ];
  for (const [key, value] of rows) {
    await execute(
      `INSERT INTO org_settings (organization_id, setting_key, setting_value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [organizationId, key, value],
    );
  }

  if (patch.currency !== undefined) {
    await execute(
      `INSERT INTO org_settings (organization_id, setting_key, setting_value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [organizationId, KEYS.currency, next.currency],
    );
  }

  return next;
}
