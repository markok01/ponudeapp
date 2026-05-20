"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PriceListRecord } from "@/types";
import { formatDate } from "@/utils/format";

export function ImportHistoryPanel() {
  const [records, setRecords] = useState<PriceListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackId, setRollbackId] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/price-lists");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecords(data);
    } catch {
      toast.error("Istorija uvoza nije učitana");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmRollback() {
    if (!rollbackId) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/price-lists/${rollbackId}/rollback`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? "Snapshot vraćen");
      setRollbackId(null);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rollback nije uspeo");
    } finally {
      setRollingBack(false);
    }
  }

  const rollbackRecord = records.find((r) => r.id === rollbackId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Istorija uvoza
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Učitavanje...
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Još nema uvezenih cenovnika u bazi.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{record.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(record.uploaded_at)}
                      {record.file_name ? ` · ${record.file_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{record.inserted_count} novo · ~{record.updated_count} ažurirano ·
                      −{record.removed_count} uklonjeno · {record.row_count} redova u fajlu
                    </p>
                  </div>
                  {record.has_snapshot ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setRollbackId(record.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Vrati snapshot
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nema snapshot-a</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(rollbackId)}
        onOpenChange={(open) => !open && setRollbackId(null)}
        title="Vratiti prethodni cenovnik?"
        description={
          rollbackRecord ? (
            <>
              Vraća stanje proizvoda <strong>pre</strong> uvoza „{rollbackRecord.name}” (
              {formatDate(rollbackRecord.uploaded_at)}). Trenutni katalog će biti zamenjen.
            </>
          ) : null
        }
        confirmLabel="Vrati snapshot"
        destructive
        loading={rollingBack}
        onConfirm={() => void confirmRollback()}
      />
    </>
  );
}
