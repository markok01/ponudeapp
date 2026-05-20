"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuotesList } from "@/components/quotes/quotes-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { Quote } from "@/types";
import { getQuoteLabel } from "@/utils/format-quote-number";

export default function QuotesPage() {
  const t = useTranslations();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Quote | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quotes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuotes(data);
    } catch {
      toast.error(t("quotes.listLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const quote = pendingDelete;
    setDeletingId(quote.id);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
      toast.success(t("quotes.deleted"));
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("quotes.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardShell
      title={t("quotes.title")}
      description={t("quotes.listDescription")}
      actions={
        <Button asChild className="w-full sm:w-auto">
          <Link href="/quotes/new">{t("quotes.newQuote")}</Link>
        </Button>
      }
    >
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : quotes.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title={t("quotes.noQuotes")}
              description={t("quotes.noQuotesHint")}
              action={
                <Button asChild>
                  <Link href="/quotes/new">{t("quotes.newQuote")}</Link>
                </Button>
              }
            />
          ) : (
            <QuotesList
              quotes={quotes}
              deletingId={deletingId}
              onDelete={(q) => setPendingDelete(q)}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("quotes.deleteTitle")}
        description={
          pendingDelete ? (
            <>
              {t("quotes.deleteBody", {
                number: getQuoteLabel(pendingDelete),
                customer: pendingDelete.customer_name,
              })}
            </>
          ) : null
        }
        confirmLabel={t("common.delete")}
        destructive
        loading={deletingId !== null}
        onConfirm={() => void confirmDelete()}
      />
    </DashboardShell>
  );
}
