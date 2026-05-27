"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildCellMetrics,
  columnWidthsToStyles,
  isFluidCatalogPanel,
  responsiveFontPx,
  sumColumnWidths,
  type CellMetrics,
} from "@/lib/catalog-table-layout";
import { quoteCatalogColsForCompact } from "@/lib/catalog-mobile-columns";
import { useMaxMdViewport } from "@/hooks/use-max-md-viewport";
import { useMaxLgViewport } from "@/hooks/use-max-lg-viewport";
import {
  loadQuoteCatalogMobilePrefs,
  resolvedMobileHiddenCols,
  saveQuoteCatalogMobilePrefs,
  type CatalogMobileToggleKey,
  type QuoteCatalogMobilePrefs,
} from "@/lib/quote-catalog-mobile-prefs";
import {
  CATALOG_COLUMN_ORDER,
  type CatalogColumnKey,
} from "@/lib/quote-workspace-layout";
import {
  clamp,
  DEFAULT_QUOTE_WORKSPACE_LAYOUT,
  loadQuoteWorkspaceLayout,
  mergeQuoteWorkspaceLayout,
  QUOTE_LAYOUT_LIMITS,
  saveQuoteWorkspaceLayout,
  layoutToStyleVars,
  shouldHideQuoteIncVatColumn,
  sumQuoteColumnWidths,
  type QuoteColumnKey,
  type QuoteWorkspaceLayout,
} from "@/lib/quote-workspace-layout";

type QuoteWorkspaceLayoutContextValue = {
  layout: QuoteWorkspaceLayout;
  styleVars: React.CSSProperties;
  catalogPanelWidth: number;
  quotePanelWidth: number;
  isCatalogFluid: boolean;
  isQuoteFluid: boolean;
  catalogColStyles: Record<CatalogColumnKey, string>;
  quoteColStyles: Record<QuoteColumnKey, string>;
  catalogTableMinWidth: string | undefined;
  quoteTableMinWidth: string | undefined;
  hideQuoteIncVat: boolean;
  isPanelResizing: boolean;
  catalogHeaderFontPx: number;
  quoteHeaderFontPx: number;
  setCatalogPanelWidth: (w: number) => void;
  setQuotePanelWidth: (w: number) => void;
  setCatalogPanelPct: (pct: number) => void;
  setPanelResizing: (resizing: boolean) => void;
  reportLivePanelWidths: (catalogPx: number, quotePx: number) => void;
  resizeCatalogPanelByDelta: (deltaPx: number, containerWidthPx: number) => void;
  resizeCatalogCol: (key: CatalogColumnKey, deltaPx: number) => void;
  resizeQuoteCol: (key: QuoteColumnKey, deltaPx: number) => void;
  resizeRowHeight: (deltaPx: number) => void;
  catalogCellMetrics: (key: CatalogColumnKey) => CellMetrics;
  quoteCellMetrics: (key: QuoteColumnKey) => CellMetrics;
  resetLayout: () => void;
  isCompactCatalog: boolean;
  catalogVisibleKeys: CatalogColumnKey[];
  catalogHiddenKeys: CatalogColumnKey[];
  catalogMobilePrefs: QuoteCatalogMobilePrefs;
  catalogMobileFocusName: boolean;
  toggleCatalogMobileColumn: (key: CatalogMobileToggleKey) => void;
  setCatalogMobileFocusName: (on: boolean) => void;
};

const QuoteWorkspaceLayoutContext =
  createContext<QuoteWorkspaceLayoutContextValue | null>(null);

export function QuoteWorkspaceLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [layout, setLayout] = useState(DEFAULT_QUOTE_WORKSPACE_LAYOUT);
  const [ready, setReady] = useState(false);
  const [catalogPanelWidth, setCatalogPanelWidth] = useState(0);
  const [quotePanelWidth, setQuotePanelWidth] = useState(0);
  const [isPanelResizing, setIsPanelResizing] = useState(false);
  const isMobileViewport = useMaxMdViewport();
  const isCompactCatalog = useMaxLgViewport();
  const [catalogMobilePrefs, setCatalogMobilePrefs] = useState(
    loadQuoteCatalogMobilePrefs,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobilePrefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLayout(loadQuoteWorkspaceLayout());
    setCatalogMobilePrefs(loadQuoteCatalogMobilePrefs());
    setReady(true);
  }, []);

  const persistMobilePrefs = useCallback((prefs: QuoteCatalogMobilePrefs) => {
    if (mobilePrefsTimer.current) clearTimeout(mobilePrefsTimer.current);
    mobilePrefsTimer.current = setTimeout(() => {
      saveQuoteCatalogMobilePrefs(prefs);
      mobilePrefsTimer.current = null;
    }, 120);
  }, []);

  const catalogHiddenKeys = useMemo(
    () => (isCompactCatalog ? resolvedMobileHiddenCols(catalogMobilePrefs) : []),
    [isCompactCatalog, catalogMobilePrefs],
  );

  const catalogVisibleKeys = useMemo(
    () => CATALOG_COLUMN_ORDER.filter((k) => !catalogHiddenKeys.includes(k)),
    [catalogHiddenKeys],
  );

  const toggleCatalogMobileColumn = useCallback(
    (key: CatalogMobileToggleKey) => {
      setCatalogMobilePrefs((prev) => {
        const hidden = new Set(prev.hidden);
        if (hidden.has(key)) hidden.delete(key);
        else hidden.add(key);
        const next = { ...prev, hidden: [...hidden] };
        persistMobilePrefs(next);
        return next;
      });
    },
    [persistMobilePrefs],
  );

  const setCatalogMobileFocusName = useCallback(
    (on: boolean) => {
      setCatalogMobilePrefs((prev) => {
        const next = { ...prev, focusName: on };
        persistMobilePrefs(next);
        return next;
      });
    },
    [persistMobilePrefs],
  );

  const persist = useCallback((next: QuoteWorkspaceLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveQuoteWorkspaceLayout(next);
      saveTimer.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    if (!ready || isPanelResizing) return;
    persist(layout);
  }, [layout, ready, persist, isPanelResizing]);

  const setPanelResizing = useCallback((resizing: boolean) => {
    setIsPanelResizing(resizing);
  }, []);

  const reportLivePanelWidths = useCallback((catalogPx: number, quotePx: number) => {
    startTransition(() => {
      setCatalogPanelWidth((prev) => (prev === catalogPx ? prev : catalogPx));
      setQuotePanelWidth((prev) => (prev === quotePx ? prev : quotePx));
    });
  }, []);

  const setCatalogPanelWidthTracked = useCallback((w: number) => {
    if (isPanelResizing) return;
    setCatalogPanelWidth(w);
  }, [isPanelResizing]);

  const setQuotePanelWidthTracked = useCallback((w: number) => {
    if (isPanelResizing) return;
    setQuotePanelWidth(w);
  }, [isPanelResizing]);

  const layoutCatalogWidth = catalogPanelWidth;
  const layoutQuoteWidth = quotePanelWidth;

  const patch = useCallback((partial: Partial<QuoteWorkspaceLayout>) => {
    setLayout((prev) => mergeQuoteWorkspaceLayout({ ...prev, ...partial }));
  }, []);

  const setCatalogPanelPct = useCallback((pct: number) => {
    patch({
      catalogPanelPct: clamp(
        pct,
        QUOTE_LAYOUT_LIMITS.catalogPanelPct.min,
        QUOTE_LAYOUT_LIMITS.catalogPanelPct.max,
      ),
    });
  }, [patch]);

  const resizeCatalogPanelByDelta = useCallback(
    (deltaPx: number, containerWidthPx: number) => {
      if (containerWidthPx <= 0) return;
      setLayout((prev) => {
        const deltaPct = (deltaPx / containerWidthPx) * 100;
        return mergeQuoteWorkspaceLayout({
          ...prev,
          catalogPanelPct: prev.catalogPanelPct + deltaPct,
        });
      });
    },
    [],
  );

  const resizeCatalogCol = useCallback(
    (key: CatalogColumnKey, deltaPx: number) => {
      setLayout((prev) =>
        mergeQuoteWorkspaceLayout({
          ...prev,
          catalogCols: {
            ...prev.catalogCols,
            [key]: prev.catalogCols[key] + deltaPx,
          },
        }),
      );
    },
    [],
  );

  const resizeQuoteCol = useCallback((key: QuoteColumnKey, deltaPx: number) => {
    if (key === "actions") return;
    setLayout((prev) =>
      mergeQuoteWorkspaceLayout({
        ...prev,
        quoteCols: {
          ...prev.quoteCols,
          [key]: prev.quoteCols[key] + deltaPx,
        },
      }),
    );
  }, []);

  const resizeRowHeight = useCallback((deltaPx: number) => {
    setLayout((prev) =>
      mergeQuoteWorkspaceLayout({
        ...prev,
        rowHeightPx: prev.rowHeightPx + deltaPx,
      }),
    );
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_QUOTE_WORKSPACE_LAYOUT);
  }, []);

  const isCatalogFluid =
    isPanelResizing ||
    isFluidCatalogPanel(layoutCatalogWidth) ||
    isMobileViewport ||
    isCompactCatalog;
  const isQuoteFluid =
    isPanelResizing ||
    isFluidCatalogPanel(layoutQuoteWidth) ||
    isMobileViewport;

  const hideQuoteIncVat = useMemo(
    () => shouldHideQuoteIncVatColumn(layoutQuoteWidth, layout.quoteCols),
    [layoutQuoteWidth, layout.quoteCols],
  );

  const quoteColExclude: QuoteColumnKey[] = hideQuoteIncVat ? ["incVat"] : [];

  const catalogColsForStyles = useMemo(() => {
    if (!isCompactCatalog) return layout.catalogCols;
    return quoteCatalogColsForCompact(layout.catalogCols, catalogHiddenKeys);
  }, [layout.catalogCols, isCompactCatalog, catalogHiddenKeys]);

  const catalogColStyles = useMemo(
    () =>
      columnWidthsToStyles(catalogColsForStyles, layoutCatalogWidth, {
        exclude: catalogHiddenKeys,
      }),
    [catalogColsForStyles, layoutCatalogWidth, catalogHiddenKeys],
  );

  const quoteColStyles = useMemo(
    () =>
      columnWidthsToStyles(layout.quoteCols, layoutQuoteWidth, {
        exclude: quoteColExclude,
      }),
    [layout.quoteCols, layoutQuoteWidth, quoteColExclude],
  );

  const catalogTableMinWidth = useMemo(() => {
    if (isCatalogFluid) return undefined;
    return `${sumColumnWidths(layout.catalogCols)}px`;
  }, [isCatalogFluid, layout.catalogCols]);

  const quoteTableMinWidth = useMemo(() => {
    if (isQuoteFluid) return undefined;
    return `${sumQuoteColumnWidths(layout.quoteCols, quoteColExclude)}px`;
  }, [isQuoteFluid, layout.quoteCols, quoteColExclude]);

  const catalogHeaderFontPx = responsiveFontPx(layoutCatalogWidth, "header");
  const quoteHeaderFontPx = responsiveFontPx(layoutQuoteWidth, "header");

  const catalogCellMetrics = useCallback(
    (key: CatalogColumnKey): CellMetrics =>
      buildCellMetrics(
        layout.catalogCols[key],
        layout.rowHeightPx,
        layoutCatalogWidth,
        key === "name" ? "name" : "compact",
      ),
    [layout.catalogCols, layout.rowHeightPx, layoutCatalogWidth],
  );

  const quoteCellMetrics = useCallback(
    (key: QuoteColumnKey): CellMetrics => {
      if (key === "actions") {
        return buildCellMetrics(
          layout.quoteCols.actions,
          layout.rowHeightPx,
          layoutQuoteWidth,
          "compact",
        );
      }
      return buildCellMetrics(
        layout.quoteCols[key],
        layout.rowHeightPx,
        layoutQuoteWidth,
        key === "name" ? "name" : "compact",
      );
    },
    [layout.quoteCols, layout.rowHeightPx, layoutQuoteWidth],
  );

  const styleVars = useMemo(
    () =>
      layoutToStyleVars(layout, layoutCatalogWidth, layoutQuoteWidth) as React.CSSProperties,
    [layout, layoutCatalogWidth, layoutQuoteWidth],
  );

  const value = useMemo(
    () => ({
      layout,
      styleVars,
      catalogPanelWidth,
      quotePanelWidth,
      isCatalogFluid,
      isQuoteFluid,
      hideQuoteIncVat,
      catalogColStyles,
      quoteColStyles,
      catalogTableMinWidth,
      quoteTableMinWidth,
      isPanelResizing,
      catalogHeaderFontPx,
      quoteHeaderFontPx,
      setCatalogPanelWidth: setCatalogPanelWidthTracked,
      setQuotePanelWidth: setQuotePanelWidthTracked,
      setCatalogPanelPct,
      setPanelResizing,
      reportLivePanelWidths,
      resizeCatalogPanelByDelta,
      resizeCatalogCol,
      resizeQuoteCol,
      resizeRowHeight,
      catalogCellMetrics,
      quoteCellMetrics,
      resetLayout,
      isCompactCatalog,
      catalogVisibleKeys,
      catalogHiddenKeys,
      catalogMobilePrefs,
      catalogMobileFocusName: catalogMobilePrefs.focusName,
      toggleCatalogMobileColumn,
      setCatalogMobileFocusName,
    }),
    [
      layout,
      styleVars,
      catalogPanelWidth,
      quotePanelWidth,
      isCatalogFluid,
      isQuoteFluid,
      catalogColStyles,
      quoteColStyles,
      catalogTableMinWidth,
      quoteTableMinWidth,
      hideQuoteIncVat,
      isPanelResizing,
      catalogHeaderFontPx,
      quoteHeaderFontPx,
      setCatalogPanelWidthTracked,
      setQuotePanelWidthTracked,
      setCatalogPanelPct,
      setPanelResizing,
      reportLivePanelWidths,
      resizeCatalogPanelByDelta,
      resizeCatalogCol,
      resizeQuoteCol,
      resizeRowHeight,
      catalogCellMetrics,
      quoteCellMetrics,
      resetLayout,
      isCompactCatalog,
      catalogVisibleKeys,
      catalogHiddenKeys,
      catalogMobilePrefs,
      toggleCatalogMobileColumn,
      setCatalogMobileFocusName,
    ],
  );

  return (
    <QuoteWorkspaceLayoutContext.Provider value={value}>
      {children}
    </QuoteWorkspaceLayoutContext.Provider>
  );
}

export function useQuoteWorkspaceLayout() {
  const ctx = useContext(QuoteWorkspaceLayoutContext);
  if (!ctx) {
    throw new Error(
      "useQuoteWorkspaceLayout must be used within QuoteWorkspaceLayoutProvider",
    );
  }
  return ctx;
}
