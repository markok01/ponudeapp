"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductNameTooltip } from "@/components/ui/product-name-tooltip";
import type { Product } from "@/types";
import {
  groupProductsByCategory,
  HORECA_BRAND_BG,
  HORECA_HEADER_BG,
  sortProductsCatalogOrder,
} from "@/utils/catalog-display";
import { CatalogTableShell } from "@/components/catalog/catalog-table-shell";
import { RowHeightHandle } from "@/components/catalog/row-height-handle";
import { ResizableColumnHead } from "@/components/catalog/resizable-column-head";
import { useProductsCatalogLayout } from "@/components/catalog/products-catalog-layout-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { ProductsCatalogColumnKey } from "@/lib/products-catalog-layout";
import type { TranslateFn } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

const COL_COUNT = 6;

type RowDraft = {
  sku: string;
  name: string;
  category: string;
  price: string;
  pdv: string;
};

function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function parsePdvInput(raw: string): number | null {
  const trimmed = raw.trim().replace("%", "");
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed.replace(",", "."));
  if (Number.isNaN(parsed)) return null;
  if (parsed > 0 && parsed <= 1) return Math.round(parsed * 100);
  return Math.min(100, Math.max(0, parsed));
}

function priceInputValue(price: number): string {
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function rowDraftFromProduct(product: Product): RowDraft {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category?.trim() ?? "",
    price: priceInputValue(product.price),
    pdv: String(product.pdv_percent),
  };
}

function groupKey(products: Product[]): string {
  return products
    .map((p) => p.id)
    .sort((a, b) => a - b)
    .join("-");
}

function isDraftDifferentFromBaseline(
  draft: RowDraft | undefined,
  baseline: RowDraft | undefined,
): boolean {
  if (!draft || !baseline) return false;
  return (
    draft.sku.trim() !== baseline.sku.trim() ||
    draft.name.trim() !== baseline.name.trim() ||
    draft.category.trim() !== baseline.category.trim() ||
    draft.price.trim() !== baseline.price.trim() ||
    draft.pdv.trim() !== baseline.pdv.trim()
  );
}

function buildBaselinesFromProducts(products: Product[]) {
  const sorted = sortProductsCatalogOrder(products);
  const grouped = groupProductsByCategory(sorted);
  const rows: Record<number, RowDraft> = {};
  const brands: Record<string, string> = {};

  for (const p of products) {
    rows[p.id] = rowDraftFromProduct(p);
  }
  for (const group of grouped) {
    brands[groupKey(group.products)] = group.groupLabel;
  }

  return { rows, brands, grouped };
}

function buildPatchFromDraft(
  product: Product,
  draft: RowDraft,
): {
  sku: string;
  name: string;
  category: string | null;
  price: number;
  pdv_percent: number;
} | null {
  const price = parsePriceInput(draft.price);
  const pdv = parsePdvInput(draft.pdv);
  if (price == null || pdv == null) return null;

  const sku = draft.sku.trim();
  const name = draft.name.trim();
  if (!sku || !name) return null;

  return {
    sku,
    name,
    category: draft.category.trim() || null,
    price,
    pdv_percent: pdv,
  };
}

interface ProductsHorecaTableProps {
  products: Product[];
  onProductUpdated: (product: Product) => void;
  onProductDeleted: (productId: number) => void;
}

export function ProductsHorecaTable({
  products,
  onProductUpdated,
  onProductDeleted,
}: ProductsHorecaTableProps) {
  const t = useTranslations();
  const {
    layout,
    colStyles,
    tableMinWidth,
    isFluid,
    resizeCol,
    resizeRowHeight,
    setContainerWidth,
    headerFontPx,
    cellMetrics,
    containerWidth,
  } = useProductsCatalogLayout();
  const sorted = sortProductsCatalogOrder(products);
  const groups = groupProductsByCategory(sorted, t("catalog.other"));

  const [rowDrafts, setRowDrafts] = useState<Record<number, RowDraft>>({});
  const [brandDrafts, setBrandDrafts] = useState<Record<string, string>>({});
  const [baselineRows, setBaselineRows] = useState<Record<number, RowDraft>>({});
  const [baselineBrands, setBaselineBrands] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleteQuoteCount, setDeleteQuoteCount] = useState(0);

  const productIdsKey = useMemo(
    () =>
      products
        .map((p) => p.id)
        .sort((a, b) => a - b)
        .join(","),
    [products],
  );

  const lastProductIdsKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastProductIdsKey.current === productIdsKey) return;
    lastProductIdsKey.current = productIdsKey;

    const { rows, brands } = buildBaselinesFromProducts(products);
    setRowDrafts(rows);
    setBrandDrafts(brands);
    setBaselineRows(rows);
    setBaselineBrands(brands);
  }, [productIdsKey, products]);

  const dirtyRowIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of products) {
      if (isDraftDifferentFromBaseline(rowDrafts[p.id], baselineRows[p.id])) {
        ids.add(p.id);
      }
    }
    return ids;
  }, [products, rowDrafts, baselineRows]);

  const dirtyBrandKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const group of groups) {
      const key = groupKey(group.products);
      const draft = (brandDrafts[key] ?? "").trim();
      const baseline = (baselineBrands[key] ?? "").trim();
      if (draft !== baseline) {
        keys.add(key);
      }
    }
    return keys;
  }, [groups, brandDrafts, baselineBrands]);

  const changeCount = dirtyRowIds.size + dirtyBrandKeys.size;
  const hasUnsavedChanges = changeCount > 0;

  const updateRowDraft = useCallback(
    (productId: number, patch: Partial<RowDraft>) => {
      setRowDrafts((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], ...patch },
      }));
    },
    [],
  );

  const updateBrandDraft = useCallback((key: string, value: string) => {
    setBrandDrafts((prev) => ({ ...prev, [key]: value }));
  }, []);

  const syncRowFromProduct = useCallback((product: Product) => {
    const draft = rowDraftFromProduct(product);
    setRowDrafts((prev) => ({ ...prev, [product.id]: draft }));
    setBaselineRows((prev) => ({ ...prev, [product.id]: draft }));
  }, []);

  const syncBrandBaseline = useCallback((key: string, label: string) => {
    setBrandDrafts((prev) => ({ ...prev, [key]: label }));
    setBaselineBrands((prev) => ({ ...prev, [key]: label }));
  }, []);

  function undoAllChanges() {
    setRowDrafts({ ...baselineRows });
    setBrandDrafts({ ...baselineBrands });
    toast.message(t("products.changesUndone"));
  }

  async function saveAllChanges() {
    if (!hasUnsavedChanges) return;

    setSaving(true);
    let savedCount = 0;

    try {
      for (const group of groups) {
        const key = groupKey(group.products);
        if (!dirtyBrandKeys.has(key)) continue;

        const nextCategory = (brandDrafts[key] ?? group.groupLabel).trim() || null;
        const label = nextCategory ?? t("catalog.other");
        for (const product of group.products) {
          const res = await fetch(`/api/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: nextCategory }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          onProductUpdated(data);
          syncRowFromProduct(data);
          savedCount++;
        }
        syncBrandBaseline(key, label);
      }

      for (const product of products) {
        if (!dirtyRowIds.has(product.id)) continue;

        const draft = rowDrafts[product.id];
        if (!draft) continue;

        const patch = buildPatchFromDraft(product, draft);
        if (!patch) {
          toast.error(t("products.validateRow", { sku: product.sku }));
          continue;
        }

        const res = await fetch(`/api/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onProductUpdated(data);
        syncRowFromProduct(data);
        savedCount++;
      }

      if (savedCount > 0) {
        toast.success(
          savedCount === 1
            ? t("products.savedCountOne")
            : t("products.savedCount", { count: savedCount }),
        );
      } else if (hasUnsavedChanges) {
        toast.error(t("products.nothingSaved"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("products.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function requestDeleteProduct(product: Product) {
    try {
      const res = await fetch(`/api/products/${product.id}/usage`);
      const data = await res.json();
      setDeleteQuoteCount(res.ok ? Number(data.quoteCount ?? 0) : 0);
    } catch {
      setDeleteQuoteCount(0);
    }
    setPendingDelete(product);
  }

  async function confirmDeleteProduct() {
    if (!pendingDelete) return;
    const product = pendingDelete;
    setDeletingId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? t("products.productRemoved"));
      onProductDeleted(product.id);
      setRowDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("products.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  if (!products.length) return null;

  return (
    <div className="space-y-3 max-md:pb-24">
      <CatalogTableShell
        className="max-md:mx-0.5"
        onWidthChange={setContainerWidth}
        scrollHint={
          <p className="scroll-hint-label px-3 pt-2 max-lg:block lg:hidden">
            {t("catalog.mobileTableHint")}
          </p>
        }
      >
        <table
          className="catalog-table catalog-table-products w-full border-collapse text-sm"
          style={{
            tableLayout: "fixed",
            width: "100%",
            minWidth: isFluid || containerWidth === 0 ? 0 : tableMinWidth,
          }}
        >
          <colgroup>
            {(
              ["sku", "name", "brand", "price", "pdv", "actions"] as ProductsCatalogColumnKey[]
            ).map((key) => (
              <col
                key={key}
                className={key === "brand" ? "catalog-col-brand-col max-md:hidden" : undefined}
                style={{ width: colStyles[key] }}
              />
            ))}
          </colgroup>
          <tbody>
            {groups.map((group) => (
              <EditableGroupBlock
                key={`${group.groupLabel}-${group.products.map((p) => p.id).join("-")}`}
                groupLabel={group.groupLabel}
                groupKey={groupKey(group.products)}
                products={group.products}
                rowDrafts={rowDrafts}
                brandDraft={brandDrafts[groupKey(group.products)] ?? group.groupLabel}
                dirtyRowIds={dirtyRowIds}
                isBrandDirty={dirtyBrandKeys.has(groupKey(group.products))}
                deletingId={deletingId}
                onRowDraftChange={updateRowDraft}
                onBrandDraftChange={updateBrandDraft}
                onDelete={requestDeleteProduct}
                resizeCol={resizeCol}
                rowHeightPx={layout.rowHeightPx}
                headerFontPx={headerFontPx}
                cellMetrics={cellMetrics}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </CatalogTableShell>
      <div className="flex justify-center">
        <RowHeightHandle
          onResize={resizeRowHeight}
          title={t("quotes.resizeRows")}
        />
      </div>

      <div
        className={cn(
          "flex flex-col gap-3 rounded-[var(--radius)] border px-3 py-3 transition-colors sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4",
          "max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-0 max-md:border-x-0 max-md:border-b-0 max-md:bg-background/95 max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.06)] max-md:backdrop-blur-md max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          hasUnsavedChanges
            ? "border-amber-400/40 bg-amber-500/8 dark:bg-amber-400/10"
            : "border-dashed border-border bg-muted/25",
        )}
      >
        <div className="min-w-0 space-y-0.5">
          {hasUnsavedChanges ? (
            <>
              <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                {t("products.unsavedTitle")}
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
                {changeCount === 1
                  ? t("products.unsavedOne")
                  : t("products.unsavedMany", { count: changeCount })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("products.noUnsaved")}</p>
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={undoAllChanges}
            disabled={!hasUnsavedChanges || saving}
          >
            <RotateCcw className="h-4 w-4" />
            {t("common.undo")}
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void saveAllChanges()}
            disabled={!hasUnsavedChanges || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("products.saveChanges")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("products.deleteTitle")}
        description={
          pendingDelete ? (
            <>
              <strong>{pendingDelete.name}</strong> ({pendingDelete.sku})
              {deleteQuoteCount > 0 ? (
                <span className="mt-2 block text-amber-800 dark:text-amber-200">
                  {t(
                    deleteQuoteCount === 1
                      ? "products.deleteInQuotes"
                      : "products.deleteInQuotesMany",
                    { count: deleteQuoteCount },
                  )}
                </span>
              ) : (
                <span className="mt-2 block">{t("products.deletePermanent")}</span>
              )}
            </>
          ) : null
        }
        confirmLabel={deleteQuoteCount > 0 ? t("products.deactivate") : t("common.delete")}
        destructive
        loading={deletingId !== null}
        onConfirm={() => void confirmDeleteProduct()}
      />
    </div>
  );
}

function EditableGroupBlock({
  groupLabel,
  groupKey: gKey,
  products,
  rowDrafts,
  brandDraft,
  dirtyRowIds,
  isBrandDirty,
  deletingId,
  onRowDraftChange,
  onBrandDraftChange,
  onDelete,
  resizeCol,
  rowHeightPx,
  headerFontPx,
  cellMetrics,
  t,
}: {
  groupLabel: string;
  groupKey: string;
  products: Product[];
  rowDrafts: Record<number, RowDraft>;
  brandDraft: string;
  dirtyRowIds: Set<number>;
  isBrandDirty: boolean;
  deletingId: number | null;
  onRowDraftChange: (id: number, patch: Partial<RowDraft>) => void;
  onBrandDraftChange: (key: string, value: string) => void;
  onDelete: (product: Product) => void;
  resizeCol: (key: ProductsCatalogColumnKey, delta: number) => void;
  rowHeightPx: number;
  headerFontPx: number;
  cellMetrics: (key: ProductsCatalogColumnKey) => import("@/lib/catalog-table-layout").CellMetrics;
  t: TranslateFn;
}) {
  const nameMetrics = cellMetrics("name");

  return (
    <>
      <tr className={cn(HORECA_BRAND_BG, "catalog-brand-row")}>
        <td
          colSpan={COL_COUNT}
          className="border border-border/50 px-2"
          style={{
            height: Math.max(26, rowHeightPx),
            paddingTop: nameMetrics.paddingYPx,
            paddingBottom: nameMetrics.paddingYPx,
          }}
        >
          <Input
            className={cn(
              "w-full min-w-0 border-transparent bg-white/10 text-center font-bold uppercase tracking-wide text-white shadow-none placeholder:text-white/50 focus-visible:border-white/40 focus-visible:bg-white/15 focus-visible:ring-1 focus-visible:ring-white/50",
              isBrandDirty && "ring-1 ring-inset ring-amber-300",
            )}
            style={{
              height: Math.max(22, rowHeightPx - 4),
              fontSize: nameMetrics.fontPx,
            }}
            value={brandDraft}
            placeholder={t("products.brandCategory")}
            onChange={(e) => onBrandDraftChange(gKey, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
      </tr>
      <tr className={HORECA_HEADER_BG}>
        <ResizableColumnHead
          align="center"
          className="catalog-col-sku"
          rowHeightPx={rowHeightPx}
          headerFontPx={headerFontPx}
          onResize={(d) => resizeCol("sku", d)}
        >
          {t("catalog.sku")}
        </ResizableColumnHead>
        <ResizableColumnHead
          className="catalog-col-name"
          rowHeightPx={rowHeightPx}
          headerFontPx={headerFontPx}
          onResize={(d) => resizeCol("name", d)}
        >
          {t("catalog.article")}
        </ResizableColumnHead>
        <ResizableColumnHead
          className="catalog-col-brand max-md:hidden"
          rowHeightPx={rowHeightPx}
          headerFontPx={headerFontPx}
          onResize={(d) => resizeCol("brand", d)}
        >
          {t("catalog.brand")}
        </ResizableColumnHead>
        <ResizableColumnHead
          align="right"
          className="catalog-col-price"
          rowHeightPx={rowHeightPx}
          headerFontPx={headerFontPx}
          onResize={(d) => resizeCol("price", d)}
        >
          {t("catalog.unitPrice")}
        </ResizableColumnHead>
        <ResizableColumnHead
          align="center"
          className="catalog-col-pdv"
          rowHeightPx={rowHeightPx}
          headerFontPx={headerFontPx}
          onResize={(d) => resizeCol("pdv", d)}
        >
          {t("catalog.vat")}
        </ResizableColumnHead>
        <ResizableColumnHead
          align="center"
          className="catalog-col-actions"
          rowHeightPx={rowHeightPx}
          headerFontPx={headerFontPx}
          resizable={false}
        >
          {""}
        </ResizableColumnHead>
      </tr>
      {products.map((product, index) => (
        <EditableProductRow
          key={product.id}
          product={product}
          draft={rowDrafts[product.id] ?? rowDraftFromProduct(product)}
          stripe={index % 2 === 0}
          isDirty={dirtyRowIds.has(product.id)}
          isDeleting={deletingId === product.id}
          rowHeightPx={rowHeightPx}
          cellMetrics={cellMetrics}
          onDraftChange={(patch) => onRowDraftChange(product.id, patch)}
          onDelete={() => onDelete(product)}
          t={t}
        />
      ))}
    </>
  );
}

function ProductsDataCell({
  colKey,
  children,
  className,
}: {
  colKey: ProductsCatalogColumnKey;
  children: React.ReactNode;
  className?: string;
}) {
  const { cellMetrics } = useProductsCatalogLayout();
  const m = cellMetrics(colKey);

  return (
    <td
      className={cn("catalog-cell border border-border/40", className)}
      style={{
        height: m.rowHeightPx,
        maxHeight: m.rowHeightPx,
        fontSize: m.fontPx,
        lineHeight: 1.25,
        paddingTop: m.paddingYPx,
        paddingBottom: m.paddingYPx,
        paddingLeft: 4,
        paddingRight: 4,
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function EditableProductRow({
  product,
  draft,
  stripe,
  isDirty,
  isDeleting,
  rowHeightPx,
  cellMetrics,
  onDraftChange,
  onDelete,
  t,
}: {
  product: Product;
  draft: RowDraft;
  stripe: boolean;
  isDirty: boolean;
  isDeleting: boolean;
  rowHeightPx: number;
  cellMetrics: (key: ProductsCatalogColumnKey) => import("@/lib/catalog-table-layout").CellMetrics;
  onDraftChange: (patch: Partial<RowDraft>) => void;
  onDelete: () => void;
  t: TranslateFn;
}) {
  const inputClass =
    "w-full min-w-0 border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background focus-visible:ring-1";

  const inputStyle = (key: ProductsCatalogColumnKey) => {
    const m = cellMetrics(key);
    return {
      height: Math.max(20, rowHeightPx - 6),
      fontSize: m.fontPx,
      padding: `${Math.max(1, m.paddingYPx - 1)}px 4px`,
    };
  };

  const btnSize = Math.max(24, rowHeightPx - 4);

  return (
    <tr
      className={cn(
        stripe ? "bg-card" : "bg-muted/25",
        isDirty && "bg-amber-500/8 dark:bg-amber-400/10",
        isDeleting && "opacity-50",
      )}
      style={{ height: rowHeightPx }}
    >
      <ProductsDataCell colKey="sku" className="catalog-col-sku">
        <Input
          className={cn(inputClass, "font-mono")}
          style={inputStyle("sku")}
          value={draft.sku}
          onChange={(e) => onDraftChange({ sku: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </ProductsDataCell>
      <ProductsDataCell colKey="name" className="catalog-col-name">
        <ProductNameTooltip text={draft.name} className="block w-full min-w-0">
          <Input
            className={cn(inputClass, "truncate")}
            style={inputStyle("name")}
            value={draft.name}
            onChange={(e) => onDraftChange({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </ProductNameTooltip>
      </ProductsDataCell>
      <ProductsDataCell colKey="brand" className="catalog-col-brand max-md:hidden">
        <Input
          className={inputClass}
          style={inputStyle("brand")}
          value={draft.category}
          placeholder={t("catalog.brandPlaceholder")}
          onChange={(e) => onDraftChange({ category: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </ProductsDataCell>
      <ProductsDataCell
        colKey="price"
        className="catalog-col-price catalog-cell-price"
      >
        <Input
          className={cn(inputClass, "text-right font-mono tabular-nums")}
          style={inputStyle("price")}
          inputMode="decimal"
          value={draft.price}
          onChange={(e) => onDraftChange({ price: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </ProductsDataCell>
      <ProductsDataCell colKey="pdv" className="catalog-col-pdv">
        <Input
          className={cn(inputClass, "text-center font-mono")}
          style={inputStyle("pdv")}
          inputMode="decimal"
          value={draft.pdv}
          onChange={(e) => onDraftChange({ pdv: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </ProductsDataCell>
      <ProductsDataCell colKey="actions" className="catalog-col-actions text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          style={{ width: btnSize, height: btnSize }}
          disabled={isDeleting}
          onClick={onDelete}
          title={t("products.deleteProduct")}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </ProductsDataCell>
    </tr>
  );
}
