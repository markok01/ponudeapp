"use client";

import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuoteBuilder } from "@/components/quotes/quote-builder";

export default function NewQuotePageClient() {
  const searchParams = useSearchParams();
  const duplicateParam = searchParams.get("duplicate");
  const duplicateFromId = duplicateParam ? Number(duplicateParam) : undefined;

  return (
    <DashboardShell
      title={duplicateFromId ? "Duplikat ponude" : "Nova ponuda"}
      description={
        duplicateFromId
          ? "Izmenite kupca i sačuvajte kao novu ponudu"
          : "Kliknite proizvod u cenovniku da ga dodate u ponudu"
      }
      breadcrumbs={[
        { label: "Ponude", href: "/quotes" },
        { label: duplicateFromId ? "Duplikat" : "Nova ponuda" },
      ]}
    >
      <QuoteBuilder duplicateFromId={duplicateFromId} />
    </DashboardShell>
  );
}
