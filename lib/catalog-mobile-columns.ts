import type { CatalogColumnKey } from "@/lib/quote-workspace-layout";
import type { ProductsCatalogColumnKey } from "@/lib/products-catalog-layout";

/** Relativne težine kolona na uskom ekranu (cene uvek dovoljno široke). */
export const PRODUCTS_MOBILE_FLUID_WEIGHTS: Record<
  ProductsCatalogColumnKey,
  number
> = {
  sku: 58,
  name: 92,
  brand: 0,
  price: 94,
  pdv: 48,
  actions: 40,
};

export const QUOTE_CATALOG_MOBILE_FLUID_WEIGHTS: Record<CatalogColumnKey, number> =
  {
    sku: 54,
    name: 96,
    price: 92,
    pdv: 44,
  };

/**
 * Na telefonu sužava naziv i širi cenu/šifru u odnosu na sačuvani desktop layout.
 */
export function colsForFluidMobile<T extends string>(
  cols: Record<T, number>,
  mobileWeights: Partial<Record<T, number>>,
): Record<T, number> {
  const out = { ...cols };
  for (const key of Object.keys(mobileWeights) as T[]) {
    const target = mobileWeights[key];
    if (target == null || target <= 0) continue;
    const current = cols[key];
    if (key === "name") {
      out[key] = Math.min(current, target);
    } else if (key === "price" || key === "sku" || key === "pdv") {
      out[key] = Math.max(current, target);
    }
  }
  return out;
}
