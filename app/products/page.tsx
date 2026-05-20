"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductsTable } from "@/components/products/products-table";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function ProductsPage() {
  const t = useTranslations();

  return (
    <DashboardShell title={t("products.title")} description={t("products.description")}>
      <ProductsTable />
    </DashboardShell>
  );
}
