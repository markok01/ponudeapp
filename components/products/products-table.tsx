"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Download, FileUp, Loader2, PackageOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { PriceListSwitcher } from "@/components/products/price-list-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductsCatalogLayoutProvider } from "@/components/catalog/products-catalog-layout-context";
import { ProductsHorecaTable } from "@/components/products/products-horeca-table";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { PriceListRecord, PriceListTemplate, Product } from "@/types";

const ALL_PRODUCTS_PAGE_SIZE = 50_000;

export function ProductsTable() {
  const t = useTranslations();
  const [lists, setLists] = useState<PriceListRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: "",
    price: "",
    pdv: "20",
    measure_unit: "",
  });

  const selected = lists.find((l) => l.id === selectedId) ?? null;
  const template: PriceListTemplate = selected?.template ?? "empty";

  const loadLists = useCallback(async (preferId?: number) => {
    setLoadingLists(true);
    try {
      const res = await fetch("/api/price-lists", { credentials: "include" });
      const data = (await res.json()) as PriceListRecord[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        throw new Error(!Array.isArray(data) ? data.error : t("lists.loadFailed"));
      }
      setLists(data);
      setSelectedId((prev) => {
        if (preferId && data.some((l) => l.id === preferId)) return preferId;
        if (prev && data.some((l) => l.id === prev)) return prev;
        return data.find((l) => l.active)?.id ?? data[0]?.id ?? null;
      });
    } catch {
      toast.error(t("lists.loadFailed"));
    } finally {
      setLoadingLists(false);
    }
  }, [t]);

  const loadProducts = useCallback(async () => {
    if (!selectedId) {
      setProducts([]);
      setTotal(0);
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(ALL_PRODUCTS_PAGE_SIZE),
        priceListId: String(selectedId),
      });
      if (showInactive) params.set("all", "1");
      if (search.trim()) params.set("search", search.trim());
      if (category !== "all") params.set("category", category);

      const res = await fetch(`/api/products?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products);
      setTotal(data.total ?? 0);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch {
      toast.error(t("products.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [selectedId, showInactive, search, category, t]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function handleProductUpdated(updated: Product) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleProductDeleted(productId: number) {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    void loadLists(selectedId ?? undefined);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      toast.error(t("lists.select"));
      return;
    }
    const price = parseFloat(form.price.replace(",", "."));
    const pdv = parseFloat(form.pdv.replace(",", "."));
    if (Number.isNaN(price) || price < 0) {
      toast.error(t("products.invalidPrice"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          category: form.category || undefined,
          price,
          pdv_percent: Number.isNaN(pdv) ? 20 : pdv,
          measure_unit: form.measure_unit || undefined,
          priceListId: selectedId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("products.productAdded"));
      setForm({ sku: "", name: "", category: "", price: "", pdv: "20", measure_unit: "" });
      setShowForm(false);
      void loadProducts();
      void loadLists(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const qs = selectedId ? `?priceListId=${selectedId}` : "";
    window.open(`/api/products/export${qs}`, "_blank");
    toast.success(t("products.exporting"));
  }

  const columnsHint = t(`lists.columns.${template}`);

  return (
    <div className="space-y-6">
      <PriceListSwitcher
        lists={lists}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChanged={(id) => void loadLists(id)}
      />

      {selected && !selected.active ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {t("lists.notActiveHint")}
        </p>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("products.addProduct")}</CardTitle>
            <p className="text-xs text-muted-foreground">{columnsHint}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              {template !== "simple" ? (
                <div className="space-y-2">
                  <Label htmlFor="sku">{t("products.sku")}</Label>
                  <Input
                    id="sku"
                    value={form.sku}
                    placeholder={t("products.skuOptional")}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="name">{t("products.article")}</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              {template !== "simple" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="category">{t("products.brandCategory")}</Label>
                  <Input
                    id="category"
                    placeholder={t("products.brandExample")}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="price">
                  {t("products.priceExVat")}
                  {selected ? ` (${selected.currency})` : ""}
                </Label>
                <Input
                  id="price"
                  inputMode="decimal"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdv">{t("products.vatPercent")}</Label>
                <Input
                  id="pdv"
                  inputMode="decimal"
                  value={form.pdv}
                  onChange={(e) => setForm({ ...form, pdv: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">{t("products.measureUnit")}</Label>
                <Input
                  id="unit"
                  placeholder={t("products.measureUnitPlaceholder")}
                  value={form.measure_unit}
                  onChange={(e) => setForm({ ...form, measure_unit: e.target.value })}
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={saving || !selectedId}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0" />
              {selected?.name ?? t("products.priceList")}
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/upload">
                  <FileUp className="h-4 w-4" />
                  {t("products.importExcel")}
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleExport}
                disabled={!selectedId}
              >
                <Download className="h-4 w-4" />
                {t("products.exportExcel")}
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => setShowForm((v) => !v)}
                disabled={!selectedId}
              >
                <Plus className="h-4 w-4" />
                {t("products.newProduct")}
              </Button>
            </div>
          </div>
          <CatalogFilters
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            categories={categories}
            resultCount={total}
            showInactive={showInactive}
            onShowInactiveChange={setShowInactive}
          />
        </CardHeader>
        <CardContent className="min-w-0 p-3 sm:p-6 max-md:px-2">
          {loadingLists || loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : !selectedId ? (
            <EmptyState
              icon={PackageOpen}
              title={t("products.noProducts")}
              description={t("products.noListHint")}
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={t("products.noProducts")}
              description={`${t("products.noProductsHint")} ${columnsHint}`}
              action={
                <Button type="button" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" />
                  {t("products.newProduct")}
                </Button>
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">{t("products.editHint")}</p>
              <ProductsCatalogLayoutProvider>
                <ProductsHorecaTable
                  products={products}
                  onProductUpdated={handleProductUpdated}
                  onProductDeleted={handleProductDeleted}
                />
              </ProductsCatalogLayoutProvider>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
