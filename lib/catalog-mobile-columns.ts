import type { CatalogColumnKey } from "@/lib/quote-workspace-layout";
import type { ProductsCatalogColumnKey } from "@/lib/products-catalog-layout";

/** Relativne težine kolona na uskom ekranu (cene uvek dovoljno široke). */
export const PRODUCTS_MOBILE_FLUID_WEIGHTS: Record<
  ProductsCatalogColumnKey,
  number
> = {
  sku: 52,
  name: 76,
  brand: 0,
  price: 98,
  pdv: 46,
  actions: 36,
};

export const QUOTE_CATALOG_MOBILE_FLUID_WEIGHTS: Record<CatalogColumnKey, number> =
  {
    sku: 50,
    name: 78,
    price: 96,
    pdv: 42,
  };

/** Širine kolona na tabu Cenovnik (telefon) — poštuje sakrivene kolone. */
export function quoteCatalogColsForCompact(
  cols: Record<CatalogColumnKey, number>,
  hidden: CatalogColumnKey[],
): Record<CatalogColumnKey, number> {
  const hiddenSet = new Set(hidden);
  const out = { ...cols };

  for (const key of hidden) {
    out[key] = 0;
  }

  const visible = (Object.keys(QUOTE_CATALOG_MOBILE_FLUID_WEIGHTS) as CatalogColumnKey[]).filter(
    (k) => !hiddenSet.has(k),
  );

  let sumVisible = visible.reduce((a, k) => a + Math.max(0, out[k] ?? 0), 0);
  if (sumVisible <= 0) {
    for (const k of visible) {
      out[k] = QUOTE_CATALOG_MOBILE_FLUID_WEIGHTS[k];
    }
    sumVisible = visible.reduce((a, k) => a + out[k], 0);
  }

  if (hiddenSet.size > 0 && visible.includes("name")) {
    const reclaimed = hidden.reduce(
      (a, k) => a + (cols[k] ?? QUOTE_CATALOG_MOBILE_FLUID_WEIGHTS[k]),
      0,
    );
    out.name = Math.min(
      520,
      Math.max(out.name ?? QUOTE_CATALOG_MOBILE_FLUID_WEIGHTS.name, 100) +
        Math.floor(reclaimed * 0.7),
    );
  }

  return out;
}

/**
 * Na telefonu: naziv užи, cene/šifra šire — ne koristi desktop širine iz localStorage.
 */
export function colsForFluidMobile<T extends string>(
  cols: Record<T, number>,
  mobileWeights: Partial<Record<T, number>>,
): Record<T, number> {
  const out = { ...cols };
  for (const key of Object.keys(mobileWeights) as T[]) {
    const preset = mobileWeights[key];
    if (preset == null) continue;
    if (preset <= 0) {
      out[key] = 0;
      continue;
    }
    const current = cols[key] ?? preset;
    if (key === "name") {
      out[key] = Math.min(current, preset);
    } else {
      out[key] = Math.max(preset, Math.min(current, preset * 1.35));
    }
  }
  return out;
}
