export type CatalogColumnKey = "sku" | "name" | "price" | "pdv";

export const CATALOG_COLUMN_ORDER: CatalogColumnKey[] = [
  "sku",
  "name",
  "price",
  "pdv",
];

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

import {
  buildCellMetrics,
  clamp,
  columnWidthsToStyles,
  cellFontSizePx,
  cellPaddingYPx,
  responsiveFontPx,
} from "@/lib/catalog-table-layout";

export { clamp, cellFontSizePx, cellPaddingYPx };

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

export const QUOTE_TABLE_COLUMN_ORDER: QuoteColumnKey[] = [
  "sku",
  "name",
  "exVat",
  "incVat",
  "discount",
  "total",
  "actions",
];

export function sumQuoteColumnWidths(
  cols: Record<QuoteColumnKey, number>,
  exclude: QuoteColumnKey[] = [],
): number {
  const skip = new Set(exclude);
  return QUOTE_TABLE_COLUMN_ORDER.filter((k) => !skip.has(k)).reduce(
    (sum, key) => sum + cols[key],
    0,
  );
}

/** Kad je panel stavki už od zbir širina kolona, sakrij „Sa PDV“ da se cene ne preklapaju. */
export function shouldHideQuoteIncVatColumn(
  panelWidthPx: number,
  cols: Record<QuoteColumnKey, number>,
): boolean {
  if (panelWidthPx <= 0) return false;
  const full = sumQuoteColumnWidths(cols);
  return panelWidthPx < full - 4;
}

export function visibleQuoteTableColumns(hideIncVat: boolean): QuoteColumnKey[] {
  return hideIncVat
    ? QUOTE_TABLE_COLUMN_ORDER.filter((k) => k !== "incVat")
    : QUOTE_TABLE_COLUMN_ORDER;
}

export function layoutToStyleVars(
  layout: QuoteWorkspaceLayout,
  catalogPanelWidthPx = 0,
  quotePanelWidthPx = 0,
): Record<string, string> {
  const row = layout.rowHeightPx;
  const catalogStyles = columnWidthsToStyles(
    layout.catalogCols,
    catalogPanelWidthPx,
  );
  const hideIncVat = shouldHideQuoteIncVatColumn(
    quotePanelWidthPx,
    layout.quoteCols,
  );
  const quoteIncVatExclude: QuoteColumnKey[] = hideIncVat ? ["incVat"] : [];
  const quoteStyles = columnWidthsToStyles(layout.quoteCols, quotePanelWidthPx, {
    exclude: quoteIncVatExclude,
  });
  const nameMetrics = buildCellMetrics(
    layout.catalogCols.name,
    row,
    catalogPanelWidthPx,
    "name",
  );
  return {
    ["--quote-row-h" as string]: `${row}px`,
    ["--quote-catalog-pct" as string]: `${layout.catalogPanelPct}%`,
    ["--quote-cell-font" as string]: `${nameMetrics.fontPx}px`,
    ["--quote-name-font" as string]: `${nameMetrics.fontPx}px`,
    ["--quote-header-font" as string]: `${responsiveFontPx(catalogPanelWidthPx, "header")}px`,
    ["--catalog-col-sku" as string]: catalogStyles.sku,
    ["--catalog-col-name" as string]: catalogStyles.name,
    ["--catalog-col-price" as string]: catalogStyles.price,
    ["--catalog-col-pdv" as string]: catalogStyles.pdv,
    ["--quote-col-sku" as string]: quoteStyles.sku,
    ["--quote-col-name" as string]: quoteStyles.name,
    ["--quote-col-exvat" as string]: quoteStyles.exVat,
    ["--quote-col-incvat" as string]: quoteStyles.incVat,
    ["--quote-col-disc" as string]: quoteStyles.discount,
    ["--quote-col-total" as string]: quoteStyles.total,
    ["--quote-col-actions" as string]: quoteStyles.actions,
  };
}
