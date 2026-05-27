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
