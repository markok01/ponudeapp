"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { PriceListRecord } from "@/types";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

const COLLAPSED_VISIBLE = 2;

function HistoryRow({
  record,
  compact,
  onRollback,
  t,
}: {
  record: PriceListRecord;
  compact: boolean;
  onRollback: (id: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <li
      className={cn(
        "flex gap-2 border-border sm:items-center sm:justify-between",
        compact ? "py-2 first:pt-0 last:pb-0" : "flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium", compact ? "text-sm" : "text-base")}>
          {record.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(record.uploaded_at)}
          {record.file_name ? ` · ${record.file_name}` : ""}
        </p>
        {!compact ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("upload.historyStats", {
              added: record.inserted_count,
              updated: record.updated_count,
              removed: record.removed_count,
              rows: record.row_count,
            })}
          </p>
        ) : null}
      </div>
      {record.has_snapshot ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("shrink-0", compact ? "h-8 px-2 text-xs" : "w-full sm:w-auto")}
          aria-label={t("upload.rollback")}
          title={t("upload.rollback")}
          onClick={() => onRollback(record.id)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {!compact ? t("upload.rollback") : null}
        </Button>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">{t("upload.noSnapshot")}</span>
      )}
    </li>
  );
}

export function ImportHistoryPanel() {
  const t = useTranslations();
  const [records, setRecords] = useState<PriceListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
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
      toast.error(t("upload.historyLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      toast.success(data.message ?? t("upload.rollbackSuccess"));
      setRollbackId(null);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("upload.rollbackFailed"));
    } finally {
      setRollingBack(false);
    }
  }

  const rollbackRecord = records.find((r) => r.id === rollbackId);
  const canExpand = records.length > COLLAPSED_VISIBLE;
  const visibleRecords = expanded ? records : records.slice(0, COLLAPSED_VISIBLE);

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="space-y-0 px-4 py-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-muted-foreground" />
            {t("upload.historyTitle")}
            {!loading && records.length > 0 ? (
              <span className="font-normal text-muted-foreground">({records.length})</span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 sm:px-6 sm:pb-4">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : records.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground">{t("upload.noHistory")}</p>
          ) : (
            <>
              <ul
                className={cn(
                  "divide-y divide-border",
                  expanded && "max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain pr-1",
                )}
              >
                {visibleRecords.map((record) => (
                  <HistoryRow
                    key={record.id}
                    record={record}
                    compact={!expanded}
                    onRollback={setRollbackId}
                    t={t}
                  />
                ))}
              </ul>
              {canExpand ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 w-full text-xs text-muted-foreground"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      {t("upload.historyShowLess")}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      {t("upload.historyShowAll", { count: records.length })}
                    </>
                  )}
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(rollbackId)}
        onOpenChange={(open) => !open && setRollbackId(null)}
        title={t("upload.rollbackTitle")}
        description={
          rollbackRecord ? t("upload.rollbackBody", { name: rollbackRecord.name }) : null
        }
        confirmLabel={t("upload.rollbackConfirm")}
        destructive
        loading={rollingBack}
        onConfirm={() => void confirmRollback()}
      />
    </>
  );
}
