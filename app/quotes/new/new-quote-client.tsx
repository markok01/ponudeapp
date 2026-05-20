"use client";

import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function NewQuotePageClient() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const duplicateParam = searchParams.get("duplicate");
  const duplicateFromId = duplicateParam ? Number(duplicateParam) : undefined;

  return (
    <DashboardShell
      variant="workspace"
      title={duplicateFromId ? t("quotes.duplicate") : t("quotes.newQuote")}
      description={
        duplicateFromId ? t("quotes.duplicateHint") : t("quotes.catalogHint")
      }
      breadcrumbs={[
        { label: t("quotes.title"), href: "/quotes" },
        {
          label: duplicateFromId ? t("quotes.duplicate") : t("quotes.newQuote"),
        },
      ]}
    >
      <QuoteBuilder duplicateFromId={duplicateFromId} />
    </DashboardShell>
  );
}
