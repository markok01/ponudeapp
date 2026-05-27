"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import {
  CatalogHorecaTable,
  CatalogSelectionHint,
} from "@/components/quotes/catalog-horeca-table";
import { QuoteLineCards } from "@/components/quotes/quote-line-cards";
import { QuoteLinesTable } from "@/components/quotes/quote-lines-table";
import { QuoteWorkspaceLayoutProvider } from "@/components/quotes/quote-workspace-layout-context";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import { QuoteWorkspaceSplit } from "@/components/quotes/quote-workspace-split";
import type { QuoteWorkspaceMobileTab } from "@/components/quotes/quote-workspace-mobile-tabs";
import { QuoteWorkspaceMeta } from "@/components/quotes/quote-workspace-meta";
import { RowHeightHandle } from "@/components/quotes/row-height-handle";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearQuoteDraft,
  hasInvalidDiscount,
  loadQuoteDraft,
  quoteDraftStorageKey,
  saveQuoteDraft,
  type QuoteBuilderDraft,
} from "@/lib/quote-draft";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type {
  Product,
  QuoteLineDraft,
  QuoteWithItems,
} from "@/types";
import { formatCurrency } from "@/utils/format";
import { sumQuoteGross, sumQuoteNet } from "@/utils/prices";

export interface QuoteBuilderProps {
  mode?: "create" | "edit";
  quoteId?: number;
  duplicateFromId?: number;
}

const ALL_CATALOG_PAGE_SIZE = 50_000;

function SaveQuoteButton({
  label,
  onClick,
  saving,
  className,
}: {
  label: string;
  onClick: () => void;
  saving: boolean;
  className?: string;
}) {
  return (
    <Button onClick={onClick} disabled={saving} size="lg" className={className}>
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {label}
    </Button>
  );
}

function quoteToLines(quote: QuoteWithItems, catalog: Product[]): QuoteLineDraft[] {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  return quote.items.map((item) => {
    const fromCatalog = byId.get(item.product_id);
    const product: Product = fromCatalog ?? {
      id: item.product_id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      price: item.unit_price,
      pdv_percent: item.pdv_percent,
      measure_unit: item.measure_unit,
      sort_order: item.sort_order,
      active: true,
      created_at: quote.created_at,
    };
    return {
      product,
      discount_percent: item.discount_percent,
      qty: item.qty,
    };
  });
}

export function QuoteBuilder({
  mode = "create",
  quoteId,
  duplicateFromId,
}: QuoteBuilderProps) {
  const t = useTranslations();
  const router = useRouter();
  const draftKey = quoteDraftStorageKey(mode === "edit" ? quoteId : undefined);
  const hydratedRef = useRef(false);

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<QuoteLineDraft[]>([]);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [discountDraft, setDiscountDraft] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(ALL_CATALOG_PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());
      if (category !== "all") params.set("category", category);

      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCatalogTotal(data.total ?? 0);
      setCatalogCategories(Array.isArray(data.categories) ? data.categories : []);
      setAllProducts(data.products ?? []);
    } catch {
      toast.error(t("products.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, category, t]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/quotes/customers");
        const data = res.ok ? await res.json() : [];
        setCustomerSuggestions(Array.isArray(data) ? data : []);
      } catch {
        /* optional */
      }
    }
    void loadCustomers();
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;

    async function hydrate() {
      const sourceId = mode === "edit" ? quoteId : duplicateFromId;
      if (sourceId) {
        try {
          const res = await fetch(`/api/quotes/${sourceId}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          const quote = data as QuoteWithItems;
          setCustomerName(
            mode === "edit"
              ? quote.customer_name
              : `${quote.customer_name} ${t("quotes.duplicateSuffix")}`,
          );
          setNote(quote.note ?? "");
          setValidUntil(quote.valid_until ?? "");
          setLines(quoteToLines(quote, allProducts));
          hydratedRef.current = true;
          return;
        } catch {
          toast.error(t("products.loadFailed"));
        }
      }

      const saved = loadQuoteDraft(draftKey);
      if (saved && mode === "create" && !duplicateFromId) {
        setCustomerName(saved.customerName);
        setNote(saved.note);
        setValidUntil(saved.validUntil);
        setLines(saved.lines);
        toast.message(t("quotes.draftLoaded"));
      }
      hydratedRef.current = true;
    }

    void hydrate();
  }, [allProducts, draftKey, duplicateFromId, mode, quoteId, t]);

  useEffect(() => {
    if (!hydratedRef.current || mode === "edit") return;
    const draft: QuoteBuilderDraft = {
      customerName,
      note,
      validUntil,
      lines,
    };
    saveQuoteDraft(draftKey, draft);
  }, [customerName, note, validUntil, lines, draftKey, mode]);

  const displayProducts = allProducts;

  const inQuoteIds = useMemo(
    () => new Set(lines.map((l) => l.product.id)),
    [lines],
  );

  const activeProduct = useMemo(
    () => allProducts.find((p) => p.id === activeProductId) ?? null,
    [allProducts, activeProductId],
  );

  const invalidDiscount = useMemo(() => hasInvalidDiscount(lines), [lines]);

  const totals = useMemo(() => {
    const items = lines.map((line) => ({
      unit_price: line.product.price,
      discount_percent: line.discount_percent,
      pdv_percent: line.product.pdv_percent,
      qty: 1,
    }));
    return {
      net: sumQuoteNet(items),
      gross: sumQuoteGross(items),
    };
  }, [lines]);

  function addProduct(product: Product) {
    setActiveProductId(product.id);
    setLines((prev) => {
      if (prev.some((l) => l.product.id === product.id)) {
        toast.info(t("quotes.alreadyInQuote"));
        return prev;
      }
      toast.success(t("quotes.added"));
      return [...prev, { product, discount_percent: 0, qty: 1 }];
    });
  }

  function updateDiscount(productId: number, discount_percent: number) {
    setLines((prev) =>
      prev.map((line) =>
        line.product.id === productId ? { ...line, discount_percent } : line,
      ),
    );
  }

  function discountInputValue(productId: number, stored: number): string {
    if (productId in discountDraft) return discountDraft[productId];
    return stored === 0 ? "" : String(stored);
  }

  function handleDiscountChange(productId: number, raw: string) {
    if (raw !== "" && !/^-?[\d.,]*$/.test(raw)) return;
    setDiscountDraft((prev) => ({ ...prev, [productId]: raw }));

    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "." || trimmed === "," || trimmed === "-") {
      updateDiscount(productId, 0);
      return;
    }

    const parsed = parseFloat(trimmed.replace(",", "."));
    if (!Number.isNaN(parsed)) updateDiscount(productId, parsed);
  }

  function handleDiscountBlur(productId: number) {
    const raw = discountDraft[productId];
    if (raw === undefined) return;

    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "." || trimmed === "," || trimmed === "-") {
      setDiscountDraft((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      updateDiscount(productId, 0);
      return;
    }

    const parsed = parseFloat(trimmed.replace(",", "."));
    const value = Number.isNaN(parsed) ? 0 : parsed;
    updateDiscount(productId, value);
    setDiscountDraft((prev) => {
      const next = { ...prev };
      if (value === 0) delete next[productId];
      else next[productId] = String(value);
      return next;
    });

    if (value < 0 || value > 100) {
      toast.warning(t("quotes.discountRange"));
    }
  }

  function removeLine(productId: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
    setDiscountDraft((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  async function saveQuote() {
    if (!customerName.trim()) {
      toast.error(t("quotes.enterCustomer"));
      return;
    }
    if (!lines.length) {
      toast.error(t("quotes.addProduct"));
      return;
    }
    if (invalidDiscount) {
      toast.error(t("quotes.fixDiscount"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_name: customerName,
        note: note.trim() || null,
        valid_until: validUntil.trim() || null,
        items: lines.map((line) => ({
          product_id: line.product.id,
          qty: 1,
          discount_percent: line.discount_percent,
        })),
      };

      const res = await fetch(
        mode === "edit" && quoteId ? `/api/quotes/${quoteId}` : "/api/quotes",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      clearQuoteDraft(draftKey);
      toast.success(mode === "edit" ? t("quotes.updated") : t("quotes.created"));
      router.push(`/quotes/${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const saveLabel = mode === "edit" ? t("quotes.saveChanges") : t("quotes.createQuote");

  return (
    <QuoteWorkspaceLayoutProvider>
      <QuoteBuilderWorkspace
        saveLabel={saveLabel}
        saveQuote={saveQuote}
        saving={saving}
        t={t}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerSuggestions={customerSuggestions}
        validUntil={validUntil}
        setValidUntil={setValidUntil}
        note={note}
        setNote={setNote}
        invalidDiscount={invalidDiscount}
        loading={loading}
        allProducts={allProducts}
        displayProducts={displayProducts}
        catalogTotal={catalogTotal}
        catalogCategories={catalogCategories}
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        inQuoteIds={inQuoteIds}
        activeProductId={activeProductId}
        addProduct={addProduct}
        activeProduct={activeProduct}
        lines={lines}
        discountInputValue={discountInputValue}
        handleDiscountChange={handleDiscountChange}
        handleDiscountBlur={handleDiscountBlur}
        removeLine={removeLine}
        totals={totals}
      />
    </QuoteWorkspaceLayoutProvider>
  );
}

function QuoteBuilderWorkspace({
  saveLabel,
  saveQuote,
  saving,
  t,
  customerName,
  setCustomerName,
  customerSuggestions,
  validUntil,
  setValidUntil,
  note,
  setNote,
  invalidDiscount,
  loading,
  allProducts,
  displayProducts,
  catalogTotal,
  catalogCategories,
  search,
  setSearch,
  category,
  setCategory,
  inQuoteIds,
  activeProductId,
  addProduct,
  activeProduct,
  lines,
  discountInputValue,
  handleDiscountChange,
  handleDiscountBlur,
  removeLine,
  totals,
}: {
  saveLabel: string;
  saveQuote: () => void;
  saving: boolean;
  t: ReturnType<typeof useTranslations>;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerSuggestions: string[];
  validUntil: string;
  setValidUntil: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  invalidDiscount: boolean;
  loading: boolean;
  allProducts: Product[];
  displayProducts: Product[];
  catalogTotal: number;
  catalogCategories: string[];
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  inQuoteIds: Set<number>;
  activeProductId: number | null;
  addProduct: (p: Product) => void;
  activeProduct: Product | null;
  lines: QuoteLineDraft[];
  discountInputValue: (id: number, stored: number) => string;
  handleDiscountChange: (id: number, raw: string) => void;
  handleDiscountBlur: (id: number) => void;
  removeLine: (id: number) => void;
  totals: { net: number; gross: number };
}) {
  const { styleVars } = useQuoteWorkspaceLayout();
  const [mobilePanel, setMobilePanel] = useState<QuoteWorkspaceMobileTab>("catalog");

  return (
    <div
      className="quote-workspace flex min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-2"
      style={styleVars as React.CSSProperties}
    >
      <QuoteWorkspaceMeta
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerSuggestions={customerSuggestions}
        validUntil={validUntil}
        setValidUntil={setValidUntil}
        note={note}
        setNote={setNote}
        saveLabel={saveLabel}
        saveQuote={saveQuote}
        saving={saving}
      />

      {invalidDiscount ? (
        <p className="shrink-0 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100 sm:text-sm">
          {t("quotes.discountInvalid")}
        </p>
      ) : null}

      <QuoteWorkspaceSplit
        mobileTab={mobilePanel}
        onMobileTabChange={setMobilePanel}
        quoteLineCount={lines.length}
        catalog={
          <div className="quote-catalog-shell flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5 sm:px-3 sm:py-2">
              <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{t("quotes.catalogTitle")}</span>
                <span className="shrink-0 text-[10px] font-normal tabular-nums text-muted-foreground">
                  ({catalogTotal.toLocaleString()})
                </span>
              </h3>
              <RowHeightHandle />
            </div>
            <div className="shrink-0 border-b border-border/40 px-2 py-1.5 sm:px-3 sm:py-2">
              <CatalogFilters
                compact
                search={search}
                onSearchChange={setSearch}
                category={category}
                onCategoryChange={setCategory}
                categories={catalogCategories}
                resultCount={catalogTotal}
              />
            </div>
            <div className="quote-catalog-body flex min-h-0 flex-1 flex-col px-1 pb-1 pt-0 sm:px-2 sm:pb-2 sm:pt-1">
              {loading && !allProducts.length ? (
                <div className="flex flex-1 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : displayProducts.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={t("common.noResults")}
                  description={t("quotes.catalogEmpty")}
                />
              ) : (
                <>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <CatalogHorecaTable
                      products={displayProducts}
                      inQuoteIds={inQuoteIds}
                      activeProductId={activeProductId}
                      onSelect={addProduct}
                    />
                  </div>
                  <div className="hidden shrink-0 border-t border-border/50 pt-1.5 lg:block">
                    <CatalogSelectionHint
                      activeProduct={activeProduct}
                      inQuoteCount={lines.length}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        }
        quote={
          <div className="quote-quote-shell flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <h3 className="text-sm font-semibold">{t("quotes.linesTitle")}</h3>
              <div className="flex items-center gap-2">
                {lines.length > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                    {lines.length}
                  </span>
                ) : null}
                <RowHeightHandle />
              </div>
            </div>
            <div className="quote-lines-body flex min-h-0 flex-1 flex-col p-2">
              {lines.length === 0 ? (
                <EmptyState
                  icon={Plus}
                  title={t("quotes.emptyQuote")}
                  description={t("quotes.emptyQuoteHint")}
                />
              ) : (
                <>
                  <div className="quote-lines-cards-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain lg:hidden">
                    <QuoteLineCards
                      lines={lines}
                      activeProductId={activeProductId}
                      discountInputValue={discountInputValue}
                      onDiscountChange={handleDiscountChange}
                      onDiscountBlur={handleDiscountBlur}
                      onRemove={removeLine}
                      invalidDiscountIds={lines
                        .filter(
                          (l) =>
                            l.discount_percent < 0 || l.discount_percent > 100,
                        )
                        .map((l) => l.product.id)}
                    />
                  </div>
                  <div className="quote-lines-desktop hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
                    <QuoteLinesTable
                      lines={lines}
                      activeProductId={activeProductId}
                      discountInputValue={discountInputValue}
                      onDiscountChange={handleDiscountChange}
                      onDiscountBlur={handleDiscountBlur}
                      onRemove={removeLine}
                    />
                  </div>
                  <div className="quote-workspace-totals mt-2 shrink-0 grid gap-2 rounded-[var(--radius-md)] border border-border/80 bg-accent/30 px-3 py-2 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t("quotes.totalExVat")}
                      </p>
                      <p className="mt-0.5 text-price text-lg sm:text-xl">
                        {formatCurrency(totals.net)}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t("quotes.totalIncVat")}
                      </p>
                      <p className="mt-0.5 text-price-total text-xl sm:text-2xl">
                        {formatCurrency(totals.gross)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      <div className="shrink-0 border-t border-border bg-background px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <SaveQuoteButton
          label={saveLabel}
          onClick={saveQuote}
          saving={saving}
          className="h-10 w-full"
        />
      </div>
    </div>
  );
}
