"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { getQuoteLabel } from "@/utils/format-quote-number";

export default function EditQuotePage() {
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
      title={`Uredi ${quoteLabel || `ponudu #${params.id}`}`}
      description="Izmenite stavke, rabat i količine"
      breadcrumbs={[
        { label: "Ponude", href: "/quotes" },
        ...(quoteLabel
          ? [{ label: quoteLabel, href: `/quotes/${params.id}` }]
          : []),
        { label: "Uredi" },
      ]}
    >
      <QuoteBuilder mode="edit" quoteId={quoteId} />
    </DashboardShell>
  );
}
