import type { AppSettings, CatalogColorPalette, CatalogThemePreset } from "@/types";

/** Trenutna (default) tema cenovnika u aplikaciji. */
export const CATALOG_THEME_DEFAULT: CatalogColorPalette = {
  brandBg: "#a89bc9",
  brandText: "#ffffff",
  headerBg: "#d4cce8",
  headerText: "#14171f",
  price: "#3b5bdb",
  priceTotal: "#2f4eb8",
};

/**
 * Silbo brand — plava / srebrna / bela po zvaničnom logu
 * (https://silbo.rs/ — oval: navy→cyan gradient, chrome okvir, beli tekst).
 */
export const CATALOG_THEME_SILBO: CatalogColorPalette = {
  brandBg: "#02124c",
  brandText: "#ffffff",
  headerBg: "#d4d8de",
  headerText: "#02124c",
  price: "#005292",
  priceTotal: "#00a7eb",
};

export const CATALOG_THEME_PRESETS: Record<
  Exclude<CatalogThemePreset, "custom">,
  CatalogColorPalette
> = {
  default: CATALOG_THEME_DEFAULT,
  silbo: CATALOG_THEME_SILBO,
};

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function isCatalogThemePreset(value: unknown): value is CatalogThemePreset {
  return value === "default" || value === "silbo" || value === "custom";
}

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

export function normalizeCatalogColors(
  raw: Partial<CatalogColorPalette> | null | undefined,
  base: CatalogColorPalette = CATALOG_THEME_DEFAULT,
): CatalogColorPalette {
  return {
    brandBg: normalizeHexColor(raw?.brandBg, base.brandBg),
    brandText: normalizeHexColor(raw?.brandText, base.brandText),
    headerBg: normalizeHexColor(raw?.headerBg, base.headerBg),
    headerText: normalizeHexColor(raw?.headerText, base.headerText),
    price: normalizeHexColor(raw?.price, base.price),
    priceTotal: normalizeHexColor(raw?.priceTotal, base.priceTotal),
  };
}

export function resolveCatalogTheme(
  preset: CatalogThemePreset | null | undefined,
  custom?: Partial<CatalogColorPalette> | null,
): CatalogColorPalette {
  const key = isCatalogThemePreset(preset) ? preset : "default";
  if (key === "custom") {
    return normalizeCatalogColors(custom, CATALOG_THEME_DEFAULT);
  }
  return { ...CATALOG_THEME_PRESETS[key] };
}

export function resolveCatalogThemeFromSettings(
  settings: Pick<AppSettings, "catalogThemePreset" | "catalogColors">,
): CatalogColorPalette {
  return resolveCatalogTheme(settings.catalogThemePreset, settings.catalogColors);
}

/** CSS custom properties for live catalog UI. */
export function catalogThemeCssVars(
  colors: CatalogColorPalette,
): Record<string, string> {
  return {
    "--horeca-brand": colors.brandBg,
    "--horeca-brand-fg": colors.brandText,
    "--horeca-header": colors.headerBg,
    "--horeca-header-fg": colors.headerText,
    "--price": colors.price,
    "--price-total": colors.priceTotal,
  };
}

export function applyCatalogThemeToDocument(colors: CatalogColorPalette): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const vars = catalogThemeCssVars(colors);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

/** Excel ARGB without # (e.g. FFA89BC9). */
export function hexToArgb(hex: string): string {
  const normalized = normalizeHexColor(hex, "#000000").slice(1).toUpperCase();
  return `FF${normalized}`;
}

export function catalogThemeToPdfColors(colors: CatalogColorPalette) {
  return {
    brand: hexToRgb(colors.brandBg),
    brandText: hexToRgb(colors.brandText),
    header: hexToRgb(colors.headerBg),
    headerText: hexToRgb(colors.headerText),
    price: hexToRgb(colors.price),
    priceTotal: hexToRgb(colors.priceTotal),
  };
}
