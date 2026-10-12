"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CustomersPanel } from "@/components/customers/customers-panel";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function CustomersPage() {
  const t = useTranslations();
  return (
    <DashboardShell title={t("customers.title")} description={t("customers.description")}>
      <CustomersPanel />
    </DashboardShell>
  );
}
