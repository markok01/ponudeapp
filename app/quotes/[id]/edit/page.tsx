"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { getQuoteLabel } from "@/utils/format-quote-number";

export default function EditQuotePage() {
  const t = useTranslations();
  const params = useParams<{ id: string }>();
  const quoteId = Number(params.id);
  const [quoteLabel, setQuoteLabel] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/quotes/${params.id}`);
        const data = await res.json();
        if (res.ok) setQuoteLabel(getQuoteLabel(data));
      } catch {
        /* builder handles errors */
      }
    }
    if (params.id) void load();
  }, [params.id]);

  return (
    <DashboardShell
      variant="workspace"
      title={
        quoteLabel
          ? t("quotes.editQuoteFor", { label: quoteLabel })
          : t("quotes.editQuote")
      }
      description={t("quotes.editItemsHint")}
      breadcrumbs={[
        { label: t("quotes.title"), href: "/quotes" },
        ...(quoteLabel
          ? [{ label: quoteLabel, href: `/quotes/${params.id}` }]
          : []),
        { label: t("common.edit") },
      ]}
    >
      <QuoteBuilder mode="edit" quoteId={quoteId} />
    </DashboardShell>
  );
}
