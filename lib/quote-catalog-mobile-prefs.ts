import type { CatalogColumnKey } from "@/lib/quote-workspace-layout";

/** Kolone koje korisnik može sakriti na telefonu (naziv uvek ostaje). */
export type CatalogMobileToggleKey = Exclude<CatalogColumnKey, "name">;

export type QuoteCatalogMobilePrefs = {
  hidden: CatalogMobileToggleKey[];
  /** Brzo sakriva šifru i PDV, širi naziv. */
  focusName: boolean;
};

export const QUOTE_CATALOG_MOBILE_PREFS_KEY =
  "ponudeapp-quote-catalog-mobile-v1";

export const DEFAULT_QUOTE_CATALOG_MOBILE_PREFS: QuoteCatalogMobilePrefs = {
  hidden: [],
  focusName: false,
};

export function loadQuoteCatalogMobilePrefs(): QuoteCatalogMobilePrefs {
  if (typeof window === "undefined") return DEFAULT_QUOTE_CATALOG_MOBILE_PREFS;
  try {
    const raw = localStorage.getItem(QUOTE_CATALOG_MOBILE_PREFS_KEY);
    if (!raw) return DEFAULT_QUOTE_CATALOG_MOBILE_PREFS;
    const parsed = JSON.parse(raw) as Partial<QuoteCatalogMobilePrefs>;
    const hidden = Array.isArray(parsed.hidden)
      ? parsed.hidden.filter(
          (k): k is CatalogMobileToggleKey =>
            k === "sku" || k === "price" || k === "pdv",
        )
      : [];
    return {
      hidden,
      focusName: Boolean(parsed.focusName),
    };
  } catch {
    return DEFAULT_QUOTE_CATALOG_MOBILE_PREFS;
  }
}

export function saveQuoteCatalogMobilePrefs(prefs: QuoteCatalogMobilePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUOTE_CATALOG_MOBILE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota */
  }
}

export function resolvedMobileHiddenCols(
  prefs: QuoteCatalogMobilePrefs,
): CatalogColumnKey[] {
  const hidden = new Set<CatalogColumnKey>(prefs.hidden);
  if (prefs.focusName) {
    hidden.add("sku");
    hidden.add("pdv");
  }
  return [...hidden];
}
