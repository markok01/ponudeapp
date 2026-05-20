"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import {
  CatalogHorecaTable,
  CatalogSelectionHint,
} from "@/components/quotes/catalog-horeca-table";
import { QuoteLineCards } from "@/components/quotes/quote-line-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clearQuoteDraft,
  hasInvalidDiscount,
  loadQuoteDraft,
  quoteDraftStorageKey,
  saveQuoteDraft,
  type QuoteBuilderDraft,
} from "@/lib/quote-draft";
import { cn } from "@/lib/utils";
import type {
  Product,
  QuoteLineDraft,
  QuoteWithItems,
} from "@/types";
import { formatCurrency } from "@/utils/format";
import {
  quoteLineGrossAfterDiscount,
  quoteLineNetAfterDiscount,
  sumQuoteGross,
  sumQuoteNet,
  unitPriceWithPdv,
} from "@/utils/prices";

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
      toast.error("Greška pri učitavanju cenovnika");
    } finally {
      setLoading(false);
    }
  }, [search, category]);

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
            mode === "edit" ? quote.customer_name : `${quote.customer_name} (kopija)`,
          );
          setNote(quote.note ?? "");
          setValidUntil(quote.valid_until ?? "");
          setLines(quoteToLines(quote, allProducts));
          hydratedRef.current = true;
          return;
        } catch {
          toast.error("Ponuda nije učitana");
        }
      }

      const saved = loadQuoteDraft(draftKey);
      if (saved && mode === "create" && !duplicateFromId) {
        setCustomerName(saved.customerName);
        setNote(saved.note);
        setValidUntil(saved.validUntil);
        setLines(saved.lines);
        toast.message("Učitan sačuvani nacrt ponude");
      }
      hydratedRef.current = true;
    }

    void hydrate();
  }, [allProducts, draftKey, duplicateFromId, mode, quoteId]);

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
        toast.info("Proizvod je već u ponudi");
        return prev;
      }
      toast.success("Dodato u ponudu");
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
      toast.warning("Rabat je van opsega 0–100%");
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
      toast.error("Unesite ime kupca");
      return;
    }
    if (!lines.length) {
      toast.error("Dodajte bar jedan proizvod");
      return;
    }
    if (invalidDiscount) {
      toast.error("Ispravite rabat (0–100%) pre čuvanja");
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
      toast.success(mode === "edit" ? "Ponuda ažurirana" : "Ponuda kreirana");
      router.push(`/quotes/${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška");
    } finally {
      setSaving(false);
    }
  }

  const saveLabel =
    mode === "edit" ? "Sačuvaj izmene" : "Kreiraj ponudu";

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="space-y-2 md:col-span-2 xl:col-span-1">
            <Label htmlFor="customer">Ime kupca</Label>
            <Input
              id="customer"
              list="customer-suggestions"
              placeholder="Npr. Kompanija d.o.o."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <datalist id="customer-suggestions">
              {customerSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <SaveQuoteButton
            label={saveLabel}
            onClick={saveQuote}
            saving={saving}
            className="hidden w-full md:flex xl:w-auto"
          />
          <div className="space-y-2 md:col-span-2 xl:col-span-2 xl:grid xl:grid-cols-2 xl:gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid-until">Rok važenja</Label>
              <Input
                id="valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Napomena (PDF)</Label>
              <Input
                id="note"
                placeholder="Opciono — prikazuje se u footeru PDF-a"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {invalidDiscount ? (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
          Jedna ili više stavki ima rabat van opsega 0–100%.
        </p>
      ) : null}

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        <Card className="order-1 min-w-0">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Cenovnik
            </CardTitle>
            <CatalogFilters
              search={search}
              onSearchChange={setSearch}
              category={category}
              onCategoryChange={setCategory}
              categories={catalogCategories}
              resultCount={catalogTotal}
            />
          </CardHeader>
          <CardContent className="space-y-4 max-md:px-2 sm:px-6">
            {loading && !allProducts.length ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : displayProducts.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nema rezultata"
                description="Promenite pretragu ili uvezite cenovnik."
              />
            ) : (
              <>
                <CatalogHorecaTable
                  products={displayProducts}
                  inQuoteIds={inQuoteIds}
                  activeProductId={activeProductId}
                  onSelect={addProduct}
                />
                <CatalogSelectionHint
                  activeProduct={activeProduct}
                  inQuoteCount={lines.length}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="order-2 min-w-0">
          <CardHeader className="p-3 sm:p-4 sm:pb-2">
            <CardTitle className="text-base">Stavke ponude</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            {lines.length === 0 ? (
              <EmptyState
                icon={Plus}
                title="Ponuda je prazna"
                description="Kliknite proizvod u cenovniku."
              />
            ) : (
              <>
                <QuoteLineCards
                  lines={lines}
                  activeProductId={activeProductId}
                  discountInputValue={discountInputValue}
                  onDiscountChange={handleDiscountChange}
                  onDiscountBlur={handleDiscountBlur}
                  onRemove={removeLine}
                  invalidDiscountIds={lines
                    .filter(
                      (l) => l.discount_percent < 0 || l.discount_percent > 100,
                    )
                    .map((l) => l.product.id)}
                />
                <HorizontalScroll className="hidden max-h-[min(72vh,720px)] md:block">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 px-2 text-[10px]">Šifra</TableHead>
                        <TableHead className="px-2 text-[10px]">Naziv</TableHead>
                        <TableHead className="px-2 text-right text-[10px]">Bez PDV</TableHead>
                        <TableHead className="px-2 text-right text-[10px]">Sa PDV</TableHead>
                        <TableHead className="w-16 px-2 text-[10px]">Rabat</TableHead>
                        <TableHead className="px-2 text-right text-[10px]">Ukupno</TableHead>
                        <TableHead className="w-8 px-1" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => {
                        const grossLine = quoteLineGrossAfterDiscount(
                          line.product.price,
                          line.discount_percent,
                          line.product.pdv_percent,
                          1,
                        );
                        const badDiscount =
                          line.discount_percent < 0 || line.discount_percent > 100;
                        const isHighlighted = activeProductId === line.product.id;
                        return (
                          <TableRow
                            key={line.product.id}
                            className={cn(isHighlighted && "bg-primary/10")}
                          >
                            <TableCell className="px-2 py-1.5 font-mono text-[11px]">
                              {line.product.sku}
                            </TableCell>
                            <TableCell className="max-w-[14rem] px-2 py-1.5">
                              <p className="truncate text-[11px] font-medium leading-tight">
                                {line.product.name}
                              </p>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums whitespace-nowrap">
                              {formatCurrency(line.product.price)}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums whitespace-nowrap">
                              {formatCurrency(
                                unitPriceWithPdv(
                                  line.product.price,
                                  line.product.pdv_percent,
                                ),
                              )}
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <Input
                                type="text"
                                inputMode="decimal"
                                className={cn(
                                  "h-7 w-14 px-1.5 text-xs",
                                  badDiscount && "border-destructive",
                                )}
                                value={discountInputValue(
                                  line.product.id,
                                  line.discount_percent,
                                )}
                                onChange={(e) =>
                                  handleDiscountChange(
                                    line.product.id,
                                    e.target.value,
                                  )
                                }
                                onBlur={() => handleDiscountBlur(line.product.id)}
                              />
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums whitespace-nowrap text-primary">
                              {formatCurrency(grossLine)}
                            </TableCell>
                            <TableCell className="px-1 py-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => removeLine(line.product.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </HorizontalScroll>
                <div className="mt-3 grid gap-3 rounded-[var(--radius)] border border-border/80 bg-accent/30 px-3 py-3 sm:grid-cols-2 sm:px-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Ukupno bez PDV
                    </p>
                    <p className="mt-1 text-price text-xl">{formatCurrency(totals.net)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Ukupno sa PDV
                    </p>
                    <p className="mt-1 text-price-total text-2xl">
                      {formatCurrency(totals.gross)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-3 border-t border-border bg-background/95 px-3 py-3 backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden sm:-mx-0">
        <SaveQuoteButton
          label={saveLabel}
          onClick={saveQuote}
          saving={saving}
          className="w-full"
        />
      </div>
      <div className="hidden justify-end border-t pt-6 md:flex">
        <SaveQuoteButton
          label={saveLabel}
          onClick={saveQuote}
          saving={saving}
          className="w-full sm:w-auto"
        />
      </div>
    </div>
  );
}
