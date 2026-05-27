"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { ResizableColumnHead } from "@/components/quotes/resizable-column-head";
import { CatalogMobileToolbar } from "@/components/quotes/catalog-mobile-toolbar";
import { CatalogMobileNamePeek } from "@/components/quotes/catalog-mobile-name-peek";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import { useContainerWidth } from "@/hooks/use-container-width";
import { useCatalogRowPeek } from "@/hooks/use-catalog-row-peek";
import type { Product } from "@/types";
import {
  formatPdvDisplay,
  formatPriceHoreca,
  groupProductsByCategory,
  HORECA_BRAND_BG,
  HORECA_HEADER_BG,
} from "@/utils/catalog-display";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { TruncatedProductName } from "@/components/ui/product-name-tooltip";
import { cn } from "@/lib/utils";
import type { CatalogColumnKey } from "@/lib/quote-workspace-layout";

interface CatalogHorecaTableProps {
  products: Product[];
  inQuoteIds: Set<number>;
  activeProductId: number | null;
  onSelect: (product: Product) => void;
}

export function CatalogHorecaTable({
  products,
  inQuoteIds,
  activeProductId,
  onSelect,
}: CatalogHorecaTableProps) {
  const t = useTranslations();
  const {
    layout,
    resizeCatalogCol,
    catalogColStyles,
    catalogTableMinWidth,
    isCatalogFluid,
    isPanelResizing,
    catalogPanelWidth,
    setCatalogPanelWidth,
    isCompactCatalog,
    catalogVisibleKeys,
    catalogMobileFocusName,
  } = useQuoteWorkspaceLayout();
  const { ref: panelRef, width: measuredWidth } = useContainerWidth<HTMLDivElement>({
    observe: !isPanelResizing,
  });
  const panelWidth = isPanelResizing ? catalogPanelWidth : measuredWidth;
  const groups = groupProductsByCategory(products, t("catalog.other"));
  const [peekProduct, setPeekProduct] = useState<Product | null>(null);

  const activeProduct =
    products.find((p) => p.id === activeProductId) ?? null;
  const peekDisplay = peekProduct ?? activeProduct;

  useEffect(() => {
    setCatalogPanelWidth(panelWidth);
  }, [panelWidth, setCatalogPanelWidth]);

  useEffect(() => {
    if (!activeProduct) return;
    setPeekProduct((prev) =>
      prev && prev.id === activeProduct.id ? prev : activeProduct,
    );
  }, [activeProduct]);

  if (!products.length) {
    return null;
  }

  const rowH = layout.rowHeightPx;
  const colSpan = catalogVisibleKeys.length;

  return (
    <div
      ref={panelRef}
      className="catalog-scroll-wrap flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card/50 shadow-[var(--shadow-soft)]"
      data-catalog-fluid={isCatalogFluid ? "true" : "false"}
      data-catalog-focus-name={catalogMobileFocusName ? "true" : "false"}
      data-catalog-compact={isCompactCatalog ? "true" : "false"}
    >
      <CatalogMobileToolbar />
      <CatalogMobileNamePeek
        product={isCompactCatalog ? peekDisplay : null}
        onDismiss={() => setPeekProduct(null)}
      />
      <p className="scroll-hint-label shrink-0 px-2 pt-1 max-lg:block lg:hidden">
        {isCompactCatalog ? t("catalog.mobileTableHintCompact") : t("catalog.mobileTableHint")}
      </p>
      <div className="catalog-scroll-area min-h-0 flex-1 basis-0 overflow-auto overscroll-contain">
        <table
          className="catalog-table w-full border-collapse text-sm"
          style={{
            tableLayout: "fixed",
            minWidth: catalogTableMinWidth,
            width: isCatalogFluid ? "100%" : catalogTableMinWidth,
          }}
        >
          <colgroup>
            {catalogVisibleKeys.map((key) => (
              <col key={key} style={{ width: catalogColStyles[key] }} />
            ))}
          </colgroup>
          <tbody>
            {groups.map((group) => (
              <GroupBlock
                key={group.groupKey}
                groupLabel={group.groupLabel}
                products={group.products}
                inQuoteIds={inQuoteIds}
                activeProductId={activeProductId}
                onSelect={onSelect}
                onPeek={setPeekProduct}
                rowH={rowH}
                colSpan={colSpan}
                visibleKeys={catalogVisibleKeys}
                onResizeCol={resizeCatalogCol}
                focusName={catalogMobileFocusName}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogDataCell({
  colKey,
  children,
  className,
  align = "left",
}: {
  colKey: CatalogColumnKey;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const { layout, catalogCellMetrics, isCatalogFluid } = useQuoteWorkspaceLayout();
  const m = catalogCellMetrics(colKey);

  return (
    <td
      className={cn(
        "catalog-cell border border-border/40 align-top",
        colKey === "name" && "catalog-cell-name",
        colKey === "price" && "catalog-cell-price",
        colKey === "pdv" && "catalog-cell-pdv",
        colKey === "sku" && "catalog-cell-sku",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className,
      )}
      style={{
        width: isCatalogFluid ? undefined : layout.catalogCols[colKey],
        height: m.rowHeightPx,
        maxHeight: m.rowHeightPx,
        fontSize: m.fontPx,
        lineHeight: 1.2,
        paddingTop: m.paddingYPx,
        paddingBottom: m.paddingYPx,
        paddingLeft: 6,
        paddingRight: 6,
      }}
    >
      {children}
    </td>
  );
}

function GroupBlock({
  groupLabel,
  products,
  inQuoteIds,
  activeProductId,
  onSelect,
  onPeek,
  rowH,
  colSpan,
  visibleKeys,
  onResizeCol,
  focusName,
}: {
  groupLabel: string;
  products: Product[];
  inQuoteIds: Set<number>;
  activeProductId: number | null;
  onSelect: (product: Product) => void;
  onPeek: (product: Product | null) => void;
  rowH: number;
  colSpan: number;
  visibleKeys: CatalogColumnKey[];
  onResizeCol: (key: CatalogColumnKey, delta: number) => void;
  focusName: boolean;
}) {
  const t = useTranslations();
  const { catalogCellMetrics } = useQuoteWorkspaceLayout();
  const brandMetrics = catalogCellMetrics("name");

  const headerMeta: Record<
    CatalogColumnKey,
    { align: "left" | "center" | "right"; label: string }
  > = {
    sku: { align: "center", label: t("catalog.sku") },
    name: { align: "left", label: t("catalog.article") },
    price: { align: "right", label: t("catalog.unitPrice") },
    pdv: { align: "center", label: t("catalog.vat") },
  };

  return (
    <>
      <tr className={HORECA_BRAND_BG}>
        <td
          colSpan={colSpan}
          className="border border-border/40 px-2 text-center font-bold uppercase tracking-wide"
          style={{
            height: Math.max(24, rowH - 4),
            fontSize: brandMetrics.fontPx,
            paddingTop: brandMetrics.paddingYPx,
            paddingBottom: brandMetrics.paddingYPx,
          }}
        >
          {groupLabel}
        </td>
      </tr>
      <tr className={HORECA_HEADER_BG}>
        {visibleKeys.map((key) => (
          <ResizableColumnHead
            key={key}
            variant="catalog"
            align={headerMeta[key].align}
            onResize={(d) => onResizeCol(key, d)}
          >
            {headerMeta[key].label}
          </ResizableColumnHead>
        ))}
      </tr>
      {products.map((product, index) => (
        <CatalogProductRow
          key={product.id}
          product={product}
          index={index}
          inQuote={inQuoteIds.has(product.id)}
          isActive={activeProductId === product.id}
          visibleKeys={visibleKeys}
          rowH={rowH}
          focusName={focusName}
          onSelect={onSelect}
          onPeek={onPeek}
        />
      ))}
    </>
  );
}

function CatalogProductRow({
  product,
  index,
  inQuote,
  isActive,
  visibleKeys,
  rowH,
  focusName,
  onSelect,
  onPeek,
}: {
  product: Product;
  index: number;
  inQuote: boolean;
  isActive: boolean;
  visibleKeys: CatalogColumnKey[];
  rowH: number;
  focusName: boolean;
  onSelect: (product: Product) => void;
  onPeek: (product: Product | null) => void;
}) {
  const { onTouchStart, onTouchEnd, onTouchCancel, consumeLongPress } =
    useCatalogRowPeek(() => onPeek(product));

  return (
    <tr
      className={cn(
        "cursor-pointer transition-colors duration-100",
        index % 2 === 0 ? "bg-card" : "bg-muted/30",
        isActive && "catalog-row-active bg-primary/15 ring-2 ring-inset ring-primary",
        !isActive && inQuote && "bg-emerald-50/90 dark:bg-emerald-950/40",
        !isActive &&
          !inQuote &&
          "hover:bg-primary/8 hover:ring-1 hover:ring-inset hover:ring-primary/40",
        focusName && isActive && "catalog-row-focus-name",
      )}
      style={{ height: rowH }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onClick={() => {
        if (consumeLongPress()) return;
        onSelect(product);
      }}
    >
      {visibleKeys.includes("sku") ? (
        <CatalogDataCell colKey="sku" className="font-mono text-muted-foreground">
          {product.sku}
        </CatalogDataCell>
      ) : null}
      {visibleKeys.includes("name") ? (
        <CatalogDataCell colKey="name" className="font-medium">
          <TruncatedProductName
            name={product.name}
            className="catalog-cell-name font-medium"
            lines={focusName ? 3 : 2}
          />
        </CatalogDataCell>
      ) : null}
      {visibleKeys.includes("price") ? (
        <CatalogDataCell
          colKey="price"
          align="right"
          className="catalog-cell-price font-mono tabular-nums text-price"
        >
          {formatPriceHoreca(product.price)}
        </CatalogDataCell>
      ) : null}
      {visibleKeys.includes("pdv") ? (
        <CatalogDataCell
          colKey="pdv"
          align="center"
          className="catalog-cell-pdv text-muted-foreground"
        >
          {formatPdvDisplay(product.pdv_percent)}
        </CatalogDataCell>
      ) : null}
    </tr>
  );
}

export function CatalogSelectionHint({
  activeProduct,
  inQuoteCount,
}: {
  activeProduct: Product | null;
  inQuoteCount: number;
}) {
  const t = useTranslations();

  if (!activeProduct && inQuoteCount === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        {t("catalog.clickToAdd")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
      {activeProduct ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
          <Plus className="h-3 w-3" />
          {t("catalog.lastPick", { sku: activeProduct.sku })}
        </span>
      ) : null}
      {inQuoteCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
          <Check className="h-3 w-3" />
          {t("catalog.inQuote", { count: inQuoteCount })}
        </span>
      ) : null}
    </div>
  );
}
