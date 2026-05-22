"use client";

import {
  createContext,
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
import {
  DEFAULT_PRODUCTS_CATALOG_LAYOUT,
  loadProductsCatalogLayout,
  mergeProductsCatalogLayout,
  PRODUCTS_CATALOG_LIMITS,
  productsCellKind,
  saveProductsCatalogLayout,
  type ProductsCatalogColumnKey,
  type ProductsCatalogLayout,
} from "@/lib/products-catalog-layout";
import { useMaxMdViewport } from "@/hooks/use-max-md-viewport";

const ALL_COLUMN_KEYS: ProductsCatalogColumnKey[] = [
  "sku",
  "name",
  "brand",
  "price",
  "pdv",
  "actions",
];

type ProductsCatalogLayoutContextValue = {
  layout: ProductsCatalogLayout;
  containerWidth: number;
  isFluid: boolean;
  /** Samo viewport < md — kolona brend se sakriva CSS-om, ne briše iz DOM-a. */
  isMobileViewport: boolean;
  colStyles: Record<ProductsCatalogColumnKey, string>;
  tableMinWidth: string | undefined;
  resizeCol: (key: ProductsCatalogColumnKey, delta: number) => void;
  resizeRowHeight: (delta: number) => void;
  setContainerWidth: (w: number) => void;
  cellMetrics: (key: ProductsCatalogColumnKey) => CellMetrics;
  headerFontPx: number;
};

const ProductsCatalogLayoutContext =
  createContext<ProductsCatalogLayoutContextValue | null>(null);

export function ProductsCatalogLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [layout, setLayout] = useState<ProductsCatalogLayout>(
    DEFAULT_PRODUCTS_CATALOG_LAYOUT,
  );
  const [containerWidth, setContainerWidth] = useState(0);
  const isMobileViewport = useMaxMdViewport();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLayout(loadProductsCatalogLayout());
  }, []);

  const persist = useCallback((next: ProductsCatalogLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveProductsCatalogLayout(next);
      saveTimer.current = null;
    }, 120);
  }, []);

  const resizeCol = useCallback(
    (key: ProductsCatalogColumnKey, delta: number) => {
      if (key === "actions") return;
      setLayout((prev) => {
        const next = mergeProductsCatalogLayout({
          cols: {
            ...prev.cols,
            [key]: prev.cols[key] + delta,
          },
        });
        if (next.cols[key] === prev.cols[key]) return prev;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resizeRowHeight = useCallback(
    (delta: number) => {
      setLayout((prev) => {
        const next = mergeProductsCatalogLayout({
          rowHeightPx: prev.rowHeightPx + delta,
        });
        if (next.rowHeightPx === prev.rowHeightPx) return prev;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isFluid = isFluidCatalogPanel(containerWidth);

  const colStyles = useMemo(
    (): Record<ProductsCatalogColumnKey, string> =>
      columnWidthsToStyles(layout.cols, containerWidth, {
        exclude: isMobileViewport
          ? (["brand"] as ProductsCatalogColumnKey[])
          : undefined,
      }),
    [layout.cols, containerWidth, isMobileViewport],
  );

  const tableMinWidth = useMemo(() => {
    if (isFluid) return undefined;
    const colsForMin = isMobileViewport
      ? (Object.fromEntries(
          ALL_COLUMN_KEYS.filter((k) => k !== "brand").map((k) => [k, layout.cols[k]]),
        ) as Record<ProductsCatalogColumnKey, number>)
      : layout.cols;
    return `${sumColumnWidths(colsForMin)}px`;
  }, [isFluid, layout.cols, isMobileViewport]);

  const headerFontPx = responsiveFontPx(containerWidth, "header");

  const cellMetrics = useCallback(
    (key: ProductsCatalogColumnKey): CellMetrics =>
      buildCellMetrics(
        layout.cols[key],
        layout.rowHeightPx,
        containerWidth,
        productsCellKind(key),
      ),
    [layout.cols, layout.rowHeightPx, containerWidth],
  );

  const value = useMemo(
    (): ProductsCatalogLayoutContextValue => ({
      layout,
      containerWidth,
      isFluid,
      isMobileViewport,
      colStyles,
      tableMinWidth,
      resizeCol,
      resizeRowHeight,
      setContainerWidth,
      cellMetrics,
      headerFontPx,
    }),
    [
      layout,
      containerWidth,
      isFluid,
      isMobileViewport,
      colStyles,
      tableMinWidth,
      resizeCol,
      resizeRowHeight,
      cellMetrics,
      headerFontPx,
    ],
  );

  return (
    <ProductsCatalogLayoutContext.Provider value={value}>
      {children}
    </ProductsCatalogLayoutContext.Provider>
  );
}

export function useProductsCatalogLayout(): ProductsCatalogLayoutContextValue {
  const ctx = useContext(ProductsCatalogLayoutContext);
  if (!ctx) {
    throw new Error(
      "useProductsCatalogLayout must be used within ProductsCatalogLayoutProvider",
    );
  }
  return ctx;
}
