import {
  clamp,
  type CellFontKind,
} from "@/lib/catalog-table-layout";

export type ProductsCatalogColumnKey =
  | "sku"
  | "name"
  | "brand"
  | "price"
  | "pdv"
  | "actions";

export type ProductsCatalogLayout = {
  cols: Record<ProductsCatalogColumnKey, number>;
  rowHeightPx: number;
};

export const PRODUCTS_CATALOG_LAYOUT_STORAGE_KEY =
  "ponudeapp-products-catalog-layout-v1";

export const DEFAULT_PRODUCTS_CATALOG_LAYOUT: ProductsCatalogLayout = {
  cols: {
    sku: 88,
    name: 280,
    brand: 130,
    price: 100,
    pdv: 52,
    actions: 44,
  },
  rowHeightPx: 32,
};

export const PRODUCTS_CATALOG_LIMITS: Record<
  ProductsCatalogColumnKey | "rowHeightPx",
  { min: number; max: number }
> = {
  sku: { min: 48, max: 140 },
  name: { min: 120, max: 560 },
  brand: { min: 72, max: 220 },
  price: { min: 64, max: 140 },
  pdv: { min: 40, max: 80 },
  actions: { min: 36, max: 56 },
  rowHeightPx: { min: 24, max: 56 },
};

export function mergeProductsCatalogLayout(
  partial: Partial<ProductsCatalogLayout>,
): ProductsCatalogLayout {
  const base = DEFAULT_PRODUCTS_CATALOG_LAYOUT;
  const cols = { ...base.cols };
  for (const key of Object.keys(cols) as ProductsCatalogColumnKey[]) {
    const v = partial.cols?.[key];
    if (v != null) {
      const lim = PRODUCTS_CATALOG_LIMITS[key];
      cols[key] = clamp(v, lim.min, lim.max);
    }
  }
  const rowLim = PRODUCTS_CATALOG_LIMITS.rowHeightPx;
  return {
    cols,
    rowHeightPx: clamp(
      partial.rowHeightPx ?? base.rowHeightPx,
      rowLim.min,
      rowLim.max,
    ),
  };
}

export function loadProductsCatalogLayout(): ProductsCatalogLayout {
  if (typeof window === "undefined") return DEFAULT_PRODUCTS_CATALOG_LAYOUT;
  try {
    const raw = localStorage.getItem(PRODUCTS_CATALOG_LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_PRODUCTS_CATALOG_LAYOUT;
    return mergeProductsCatalogLayout(JSON.parse(raw) as Partial<ProductsCatalogLayout>);
  } catch {
    return DEFAULT_PRODUCTS_CATALOG_LAYOUT;
  }
}

export function saveProductsCatalogLayout(layout: ProductsCatalogLayout): void {
  try {
    localStorage.setItem(
      PRODUCTS_CATALOG_LAYOUT_STORAGE_KEY,
      JSON.stringify(layout),
    );
  } catch {
    /* quota */
  }
}

export function productsCellKind(
  key: ProductsCatalogColumnKey,
): CellFontKind {
  if (key === "name") return "name";
  return "compact";
}
