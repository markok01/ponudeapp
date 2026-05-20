"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuoteExportModal } from "@/components/quotes/quote-export-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { QuoteDetailItems } from "@/components/quotes/quote-detail-items";
import type { QuoteWithItems } from "@/types";
import { exportQuoteExcel } from "@/utils/export-excel";
import { formatCurrency, formatDate } from "@/utils/format";
import { getQuoteLabel } from "@/utils/format-quote-number";
import { sumQuoteGross, sumQuoteNet } from "@/utils/prices";

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/quotes/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setQuote(data);
      } catch {
        toast.error("Ponuda nije pronađena");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) void load();
  }, [params.id]);

  const quoteLabel = quote ? getQuoteLabel(quote) : "";

  const breadcrumbs = useMemo((): BreadcrumbItem[] | undefined => {
    if (!quote) return undefined;
    const items: BreadcrumbItem[] = [
      { label: "Ponude", href: "/quotes" },
      { label: quoteLabel, href: `/quotes/${quote.id}` },
    ];
    if (pdfModalOpen) {
      items.push({ label: "PDF" });
    }
    return items;
  }, [quote, quoteLabel, pdfModalOpen]);

  const totals = quote
    ? {
        net: sumQuoteNet(quote.items),
        gross: sumQuoteGross(quote.items),
      }
    : { net: 0, gross: 0 };

  if (loading) {
    return (
      <DashboardShell title="Ponuda" description="Učitavanje...">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Učitavanje ponude...
        </div>
      </DashboardShell>
    );
  }

  if (!quote) {
    return (
      <DashboardShell title="Ponuda" description="Nije pronađena">
        <p className="text-muted-foreground">Ponuda ne postoji.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      printClassName="quote-detail-print"
      title={quoteLabel}
      description={`${quote.customer_name} · ${formatDate(quote.created_at)}`}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto no-print"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Štampaj
          </Button>
          <Button variant="outline" className="w-full sm:w-auto print:hidden" asChild>
            <Link href={`/quotes/${quote.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Uredi
            </Link>
          </Button>
          <Button variant="outline" className="w-full sm:w-auto print:hidden" asChild>
            <Link href={`/quotes/new?duplicate=${quote.id}`}>
              <Copy className="h-4 w-4" />
              Duplikat
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto no-print"
            onClick={() => setPdfModalOpen(true)}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto no-print"
            onClick={async () => {
              try {
                await exportQuoteExcel(quote);
                toast.success("Excel preuzet");
              } catch {
                toast.error("Excel export nije uspeo");
              }
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      }
    >
      <div className="quote-print-header">
        <p className="text-lg font-semibold">{quoteLabel}</p>
        <p className="text-sm text-muted-foreground">{quote.customer_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(quote.created_at)}
          {quote.valid_until ? ` · Važi do ${formatDate(quote.valid_until)}` : ""}
        </p>
      </div>

      {quote.valid_until ? (
        <p className="mb-4 text-sm text-muted-foreground no-print">
          Važi do: {formatDate(quote.valid_until)}
        </p>
      ) : null}

      {quote.note ? (
        <p className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {quote.note}
        </p>
      ) : null}

      <Card className="quote-print-card min-w-0 overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Stavke</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <QuoteDetailItems items={quote.items} />
          <div className="grid gap-4 border-t border-border bg-accent/25 px-4 py-4 sm:grid-cols-2 sm:px-6 sm:py-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Ukupno bez PDV
              </p>
              <p className="mt-1 text-price text-xl">{formatCurrency(totals.net)}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Ukupno sa PDV
              </p>
              <p className="mt-1 text-price-total text-2xl">
                {formatCurrency(totals.gross)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <QuoteExportModal
        quote={quote}
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
      />
    </DashboardShell>
  );
}
