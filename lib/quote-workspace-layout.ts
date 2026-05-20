export type CatalogColumnKey = "sku" | "name" | "price" | "pdv";

export type QuoteColumnKey =
  | "sku"
  | "name"
  | "exVat"
  | "incVat"
  | "discount"
  | "total"
  | "actions";

export type QuoteWorkspaceLayout = {
  catalogPanelPct: number;
  catalogCols: Record<CatalogColumnKey, number>;
  quoteCols: Record<QuoteColumnKey, number>;
  rowHeightPx: number;
};

export const QUOTE_LAYOUT_STORAGE_KEY = "ponudeapp-quote-workspace-layout-v1";

export const DEFAULT_QUOTE_WORKSPACE_LAYOUT: QuoteWorkspaceLayout = {
  catalogPanelPct: 40,
  catalogCols: { sku: 76, name: 220, price: 88, pdv: 44 },
  quoteCols: {
    sku: 68,
    name: 200,
    exVat: 80,
    incVat: 80,
    discount: 56,
    total: 84,
    actions: 36,
  },
  rowHeightPx: 32,
};

export const QUOTE_LAYOUT_LIMITS = {
  catalogPanelPct: { min: 22, max: 68 },
  catalogCols: {
    sku: { min: 48, max: 140 },
    name: { min: 100, max: 520 },
    price: { min: 64, max: 140 },
    pdv: { min: 36, max: 72 },
  },
  quoteCols: {
    sku: { min: 44, max: 120 },
    name: { min: 100, max: 480 },
    exVat: { min: 56, max: 120 },
    incVat: { min: 56, max: 120 },
    discount: { min: 44, max: 88 },
    total: { min: 56, max: 120 },
    actions: { min: 32, max: 48 },
  },
  rowHeightPx: { min: 22, max: 52 },
};

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function loadQuoteWorkspaceLayout(): QuoteWorkspaceLayout {
  if (typeof window === "undefined") return DEFAULT_QUOTE_WORKSPACE_LAYOUT;
  try {
    const raw = localStorage.getItem(QUOTE_LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_QUOTE_WORKSPACE_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<QuoteWorkspaceLayout>;
    return mergeQuoteWorkspaceLayout(parsed);
  } catch {
    return DEFAULT_QUOTE_WORKSPACE_LAYOUT;
  }
}

export function mergeQuoteWorkspaceLayout(
  partial: Partial<QuoteWorkspaceLayout>,
): QuoteWorkspaceLayout {
  const base = DEFAULT_QUOTE_WORKSPACE_LAYOUT;
  return {
    catalogPanelPct: clamp(
      partial.catalogPanelPct ?? base.catalogPanelPct,
      QUOTE_LAYOUT_LIMITS.catalogPanelPct.min,
      QUOTE_LAYOUT_LIMITS.catalogPanelPct.max,
    ),
    catalogCols: {
      sku: clamp(
        partial.catalogCols?.sku ?? base.catalogCols.sku,
        QUOTE_LAYOUT_LIMITS.catalogCols.sku.min,
        QUOTE_LAYOUT_LIMITS.catalogCols.sku.max,
      ),
      name: clamp(
        partial.catalogCols?.name ?? base.catalogCols.name,
        QUOTE_LAYOUT_LIMITS.catalogCols.name.min,
        QUOTE_LAYOUT_LIMITS.catalogCols.name.max,
      ),
      price: clamp(
        partial.catalogCols?.price ?? base.catalogCols.price,
        QUOTE_LAYOUT_LIMITS.catalogCols.price.min,
        QUOTE_LAYOUT_LIMITS.catalogCols.price.max,
      ),
      pdv: clamp(
        partial.catalogCols?.pdv ?? base.catalogCols.pdv,
        QUOTE_LAYOUT_LIMITS.catalogCols.pdv.min,
        QUOTE_LAYOUT_LIMITS.catalogCols.pdv.max,
      ),
    },
    quoteCols: {
      sku: clamp(
        partial.quoteCols?.sku ?? base.quoteCols.sku,
        QUOTE_LAYOUT_LIMITS.quoteCols.sku.min,
        QUOTE_LAYOUT_LIMITS.quoteCols.sku.max,
      ),
      name: clamp(
        partial.quoteCols?.name ?? base.quoteCols.name,
        QUOTE_LAYOUT_LIMITS.quoteCols.name.min,
        QUOTE_LAYOUT_LIMITS.quoteCols.name.max,
      ),
      exVat: clamp(
        partial.quoteCols?.exVat ?? base.quoteCols.exVat,
        QUOTE_LAYOUT_LIMITS.quoteCols.exVat.min,
        QUOTE_LAYOUT_LIMITS.quoteCols.exVat.max,
      ),
      incVat: clamp(
        partial.quoteCols?.incVat ?? base.quoteCols.incVat,
        QUOTE_LAYOUT_LIMITS.quoteCols.incVat.min,
        QUOTE_LAYOUT_LIMITS.quoteCols.incVat.max,
      ),
      discount: clamp(
        partial.quoteCols?.discount ?? base.quoteCols.discount,
        QUOTE_LAYOUT_LIMITS.quoteCols.discount.min,
        QUOTE_LAYOUT_LIMITS.quoteCols.discount.max,
      ),
      total: clamp(
        partial.quoteCols?.total ?? base.quoteCols.total,
        QUOTE_LAYOUT_LIMITS.quoteCols.total.min,
        QUOTE_LAYOUT_LIMITS.quoteCols.total.max,
      ),
      actions: clamp(
        partial.quoteCols?.actions ?? base.quoteCols.actions,
        QUOTE_LAYOUT_LIMITS.quoteCols.actions.min,
        QUOTE_LAYOUT_LIMITS.quoteCols.actions.max,
      ),
    },
    rowHeightPx: clamp(
      partial.rowHeightPx ?? base.rowHeightPx,
      QUOTE_LAYOUT_LIMITS.rowHeightPx.min,
      QUOTE_LAYOUT_LIMITS.rowHeightPx.max,
    ),
  };
}

export function saveQuoteWorkspaceLayout(layout: QuoteWorkspaceLayout): void {
  try {
    localStorage.setItem(QUOTE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota / private mode */
  }
}

/** Font u ćeliji skalira se sa širinom kolone i visinom reda. */
export function cellFontSizePx(
  colWidthPx: number,
  rowHeightPx: number,
  kind: "compact" | "name" | "header" = "compact",
): number {
  const rowScale = rowHeightPx / DEFAULT_QUOTE_WORKSPACE_LAYOUT.rowHeightPx;
  const colScale =
    colWidthPx /
    (kind === "name"
      ? DEFAULT_QUOTE_WORKSPACE_LAYOUT.catalogCols.name
      : kind === "header"
        ? 90
        : DEFAULT_QUOTE_WORKSPACE_LAYOUT.catalogCols.sku);
  const base = kind === "name" ? 12 : kind === "header" ? 10 : 11;
  const scaled = base * Math.min(rowScale, colScale);
  return Math.round(clamp(scaled, 8, 14));
}

export function cellPaddingYPx(rowHeightPx: number, fontPx: number): number {
  return Math.max(2, Math.floor((rowHeightPx - fontPx) / 2) - 1);
}

export function layoutToStyleVars(
  layout: QuoteWorkspaceLayout,
): Record<string, string> {
  const row = layout.rowHeightPx;
  const nameFont = cellFontSizePx(layout.catalogCols.name, row, "name");
  return {
    ["--quote-row-h" as string]: `${row}px`,
    ["--quote-catalog-pct" as string]: `${layout.catalogPanelPct}%`,
    ["--quote-cell-font" as string]: `${cellFontSizePx(layout.catalogCols.sku, row)}px`,
    ["--quote-name-font" as string]: `${nameFont}px`,
    ["--quote-header-font" as string]: `${cellFontSizePx(90, row, "header")}px`,
    ["--catalog-col-sku" as string]: `${layout.catalogCols.sku}px`,
    ["--catalog-col-name" as string]: `${layout.catalogCols.name}px`,
    ["--catalog-col-price" as string]: `${layout.catalogCols.price}px`,
    ["--catalog-col-pdv" as string]: `${layout.catalogCols.pdv}px`,
    ["--quote-col-sku" as string]: `${layout.quoteCols.sku}px`,
    ["--quote-col-name" as string]: `${layout.quoteCols.name}px`,
    ["--quote-col-exvat" as string]: `${layout.quoteCols.exVat}px`,
    ["--quote-col-incvat" as string]: `${layout.quoteCols.incVat}px`,
    ["--quote-col-disc" as string]: `${layout.quoteCols.discount}px`,
    ["--quote-col-total" as string]: `${layout.quoteCols.total}px`,
    ["--quote-col-actions" as string]: `${layout.quoteCols.actions}px`,
  };
}
