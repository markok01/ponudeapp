"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PdfConverterPanel } from "@/components/pdf-to-excel/pdf-converter-panel";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function PdfToExcelPage() {
  const t = useTranslations();

  return (
    <DashboardShell
      title={t("pdfToExcel.title")}
      description={t("pdfToExcel.description")}
    >
      <PdfConverterPanel />
    </DashboardShell>
  );
}
