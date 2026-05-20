"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Download, Loader2, PackageOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductsHorecaTable } from "@/components/products/products-horeca-table";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { Product } from "@/types";

const ALL_PRODUCTS_PAGE_SIZE = 50_000;

export function ProductsTable() {
  const t = useTranslations();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
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
  });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(ALL_PRODUCTS_PAGE_SIZE),
      });
      if (showInactive) params.set("all", "1");
      if (search.trim()) params.set("search", search.trim());
      if (category !== "all") params.set("category", category);

      const res = await fetch(`/api/products?${params}`);
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
  }, [showInactive, search, category, t]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function handleProductUpdated(updated: Product) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleProductDeleted(productId: number) {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          category: form.category || undefined,
          price,
          pdv_percent: Number.isNaN(pdv) ? 20 : pdv,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("products.productAdded"));
      setForm({ sku: "", name: "", category: "", price: "", pdv: "20" });
      setShowForm(false);
      void loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    window.open("/api/products/export", "_blank");
    toast.success(t("products.exporting"));
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("products.addProduct")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">{t("products.sku")}</Label>
                <Input
                  id="sku"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t("products.article")}</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="category">{t("products.brandCategory")}</Label>
                <Input
                  id="category"
                  placeholder={t("products.brandExample")}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t("products.priceExVat")}</Label>
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
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={saving}>
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
              {t("products.priceList")}
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleExport}>
                <Download className="h-4 w-4" />
                {t("products.exportExcel")}
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
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
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={t("products.noProducts")}
              description={t("products.noProductsHint")}
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">{t("products.editHint")}</p>
              <ProductsHorecaTable
                products={products}
                onProductUpdated={handleProductUpdated}
                onProductDeleted={handleProductDeleted}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
