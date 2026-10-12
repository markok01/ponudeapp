import { defaultCurrencyForLocale, normalizeCurrency } from "@/lib/currency";
import {
  CATALOG_THEME_DEFAULT,
  isCatalogThemePreset,
  normalizeCatalogColors,
} from "@/lib/catalog-theme";
import { normalizeLocale } from "@/lib/i18n/types";
import type { AppSettings, CatalogColorPalette, CatalogThemePreset } from "@/types";

const STORAGE_KEY = "ponudeapp-settings";

const DEFAULTS: AppSettings = {
  logoDataUrl: null,
  companyName: "",
  taxId: "",
  address: "",
  phone: "",
  bankAccount: "",
  stampDataUrl: null,
  membersCanLockQuotes: false,
  locale: "sr",
  currency: defaultCurrencyForLocale("sr"),
  catalogThemePreset: "default",
  catalogColors: { ...CATALOG_THEME_DEFAULT },
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function parseCatalogTheme(parsed: Partial<AppSettings>): {
  catalogThemePreset: CatalogThemePreset;
  catalogColors: CatalogColorPalette;
} {
  const preset = isCatalogThemePreset(parsed.catalogThemePreset)
    ? parsed.catalogThemePreset
    : "default";
  return {
    catalogThemePreset: preset,
    catalogColors: normalizeCatalogColors(
      parsed.catalogColors,
      CATALOG_THEME_DEFAULT,
    ),
  };
}

export function getAppSettingsLocal(): AppSettings {
  if (!canUseStorage()) return { ...DEFAULTS, catalogColors: { ...CATALOG_THEME_DEFAULT } };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, catalogColors: { ...CATALOG_THEME_DEFAULT } };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const locale = normalizeLocale(parsed.locale);
    const theme = parseCatalogTheme(parsed);
    return {
      logoDataUrl:
        typeof parsed.logoDataUrl === "string" ? parsed.logoDataUrl : null,
      companyName:
        typeof parsed.companyName === "string" ? parsed.companyName : "",
      taxId: typeof parsed.taxId === "string" ? parsed.taxId : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      bankAccount: typeof parsed.bankAccount === "string" ? parsed.bankAccount : "",
      stampDataUrl:
        typeof parsed.stampDataUrl === "string" ? parsed.stampDataUrl : null,
      membersCanLockQuotes: parsed.membersCanLockQuotes === true,
      locale,
      currency:
        parsed.currency !== undefined
          ? normalizeCurrency(parsed.currency)
          : defaultCurrencyForLocale(locale),
      ...theme,
    };
  } catch {
    return { ...DEFAULTS, catalogColors: { ...CATALOG_THEME_DEFAULT } };
  }
}

export function saveAppSettingsLocal(patch: Partial<AppSettings>): AppSettings {
  const current = getAppSettingsLocal();
  const next: AppSettings = {
    ...current,
    ...patch,
    catalogColors: normalizeCatalogColors(
      patch.catalogColors ?? current.catalogColors,
      CATALOG_THEME_DEFAULT,
    ),
    catalogThemePreset: isCatalogThemePreset(patch.catalogThemePreset)
      ? patch.catalogThemePreset
      : current.catalogThemePreset,
  };
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearAppLogoLocal(): AppSettings {
  return saveAppSettingsLocal({ logoDataUrl: null });
}

/** Učitava iz API-ja, kešira u localStorage. */
export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (!res.ok) return getAppSettingsLocal();
    const data = (await res.json()) as AppSettings;
    saveAppSettingsLocal(data);
    return data;
  } catch {
    return getAppSettingsLocal();
  }
}

/** Čuva u API i localStorage. */
export async function persistAppSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const local = saveAppSettingsLocal(patch);

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local),
    });
    if (res.ok) {
      const data = (await res.json()) as AppSettings;
      saveAppSettingsLocal(data);
      return data;
    }
  } catch {
    /* offline — local only */
  }

  return local;
}

// Backward-compatible aliases
export const getAppSettings = getAppSettingsLocal;
export const saveAppSettings = saveAppSettingsLocal;
export const clearAppLogo = clearAppLogoLocal;
