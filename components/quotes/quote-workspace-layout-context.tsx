"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  cellFontSizePx,
  cellPaddingYPx,
  clamp,
  DEFAULT_QUOTE_WORKSPACE_LAYOUT,
  loadQuoteWorkspaceLayout,
  mergeQuoteWorkspaceLayout,
  QUOTE_LAYOUT_LIMITS,
  saveQuoteWorkspaceLayout,
  layoutToStyleVars,
  type CatalogColumnKey,
  type QuoteColumnKey,
  type QuoteWorkspaceLayout,
} from "@/lib/quote-workspace-layout";

type CellMetrics = {
  fontPx: number;
  paddingYPx: number;
};

type QuoteWorkspaceLayoutContextValue = {
  layout: QuoteWorkspaceLayout;
  styleVars: React.CSSProperties;
  setCatalogPanelPct: (pct: number) => void;
  resizeCatalogPanelByDelta: (deltaPx: number, containerWidthPx: number) => void;
  resizeCatalogCol: (key: CatalogColumnKey, deltaPx: number) => void;
  resizeQuoteCol: (key: QuoteColumnKey, deltaPx: number) => void;
  resizeRowHeight: (deltaPx: number) => void;
  catalogCellMetrics: (key: CatalogColumnKey) => CellMetrics;
  quoteCellMetrics: (key: QuoteColumnKey) => CellMetrics;
  resetLayout: () => void;
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

  useEffect(() => {
    setLayout(loadQuoteWorkspaceLayout());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveQuoteWorkspaceLayout(layout);
  }, [layout, ready]);

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

  const catalogCellMetrics = useCallback(
    (key: CatalogColumnKey): CellMetrics => {
      const w = layout.catalogCols[key];
      const kind = key === "name" ? "name" : "compact";
      const fontPx = cellFontSizePx(w, layout.rowHeightPx, kind);
      return { fontPx, paddingYPx: cellPaddingYPx(layout.rowHeightPx, fontPx) };
    },
    [layout],
  );

  const quoteCellMetrics = useCallback(
    (key: QuoteColumnKey): CellMetrics => {
      if (key === "actions") {
        return {
          fontPx: cellFontSizePx(36, layout.rowHeightPx),
          paddingYPx: cellPaddingYPx(
            layout.rowHeightPx,
            cellFontSizePx(36, layout.rowHeightPx),
          ),
        };
      }
      const w = layout.quoteCols[key];
      const kind = key === "name" ? "name" : "compact";
      const fontPx = cellFontSizePx(w, layout.rowHeightPx, kind);
      return { fontPx, paddingYPx: cellPaddingYPx(layout.rowHeightPx, fontPx) };
    },
    [layout],
  );

  const value = useMemo(
    () => ({
      layout,
      styleVars: layoutToStyleVars(layout),
      setCatalogPanelPct,
      resizeCatalogPanelByDelta,
      resizeCatalogCol,
      resizeQuoteCol,
      resizeRowHeight,
      catalogCellMetrics,
      quoteCellMetrics,
      resetLayout,
    }),
    [
      layout,
      setCatalogPanelPct,
      resizeCatalogPanelByDelta,
      resizeCatalogCol,
      resizeQuoteCol,
      resizeRowHeight,
      catalogCellMetrics,
      quoteCellMetrics,
      resetLayout,
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
