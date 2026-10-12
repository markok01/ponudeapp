"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { isQuoteLocked } from "@/lib/quote-status";
import type { QuoteWithItems } from "@/types";
import { getQuoteLabel } from "@/utils/format-quote-number";

export default function EditQuotePage() {
  const t = useTranslations();
  const params = useParams<{ id: string }>();
  const quoteId = Number(params.id);
  const [quoteLabel, setQuoteLabel] = useState("");
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/quotes/${params.id}`);
        const data = (await res.json()) as QuoteWithItems;
        if (res.ok) {
          setQuoteLabel(getQuoteLabel(data));
          setLocked(isQuoteLocked(data.status));
        }
      } catch {
        /* builder handles errors */
      } finally {
        setReady(true);
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
      description={locked ? t("quotes.lockedEdit") : t("quotes.editItemsHint")}
      breadcrumbs={[
        { label: t("quotes.title"), href: "/quotes" },
        ...(quoteLabel
          ? [{ label: quoteLabel, href: `/quotes/${params.id}` }]
          : []),
        { label: t("common.edit") },
      ]}
    >
      {!ready ? null : locked ? (
        <div className="mx-auto max-w-lg space-y-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t("quotes.lockedEdit")}</p>
          <Button asChild variant="outline">
            <Link href={`/quotes/${params.id}`}>{t("quotes.detailTitle")}</Link>
          </Button>
        </div>
      ) : (
        <QuoteBuilder mode="edit" quoteId={quoteId} />
      )}
    </DashboardShell>
  );
}
