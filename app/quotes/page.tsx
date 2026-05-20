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
import type { Quote } from "@/types";
import { getQuoteLabel } from "@/utils/format-quote-number";

export default function QuotesPage() {
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
      toast.error("Greška pri učitavanju ponuda");
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.success("Ponuda obrisana");
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri brisanju");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardShell
      title="Ponude"
      description="Lista svih kreiranih ponuda"
      actions={
        <Button asChild className="w-full sm:w-auto">
          <Link href="/quotes/new">Nova ponuda</Link>
        </Button>
      }
    >
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Učitavanje...
            </div>
          ) : quotes.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Nema ponuda"
              description="Kreirajte prvu ponudu za kupca."
              action={
                <Button asChild>
                  <Link href="/quotes/new">Nova ponuda</Link>
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
        title="Obrisati ponudu?"
        description={
          pendingDelete ? (
            <>
              Ponuda <strong>{getQuoteLabel(pendingDelete)}</strong> za kupca{" "}
              <strong>{pendingDelete.customer_name}</strong> biće trajno obrisana.
            </>
          ) : null
        }
        confirmLabel="Obriši"
        destructive
        loading={deletingId !== null}
        onConfirm={() => void confirmDelete()}
      />
    </DashboardShell>
  );
}
