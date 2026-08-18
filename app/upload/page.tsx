"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Eye,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { convertPdfOnServer, downloadExcelBlob } from "@/lib/client-pdf-convert";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { ImportPreviewDiff, PriceListRecord } from "@/types";

export default function UploadPage() {
  const t = useTranslations();
  const router = useRouter();

  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertStatus, setConvertStatus] = useState("");

  const [lists, setLists] = useState<PriceListRecord[]>([]);
  const [priceListId, setPriceListId] = useState<number | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewDiff | null>(null);
  const [pdfServiceOk, setPdfServiceOk] = useState<boolean | null>(null);
  const [pdfLocalHoreca, setPdfLocalHoreca] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const selected = lists.find((l) => l.id === priceListId) ?? null;

  const loadLists = useCallback(async () => {
    try {
      const res = await fetch("/api/price-lists", { credentials: "include" });
      const data = (await res.json()) as PriceListRecord[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) return;
      setLists(data);
      setPriceListId((prev) => {
        if (prev && data.some((l) => l.id === prev)) return prev;
        return data.find((l) => l.active)?.id ?? data[0]?.id ?? null;
      });
    } catch {
      toast.error(t("lists.loadFailed"));
    }
  }, [t]);

  const checkPdfService = useCallback(async () => {
    try {
      const res = await fetch("/api/pdf-convert");
      const data = await res.json();
      setPdfServiceOk(data.available === true);
      setPdfLocalHoreca(data.localHorecaSync === true);
    } catch {
      setPdfServiceOk(false);
      setPdfLocalHoreca(false);
    }
  }, []);

  useEffect(() => {
    void checkPdfService();
    void loadLists();
  }, [checkPdfService, loadLists]);

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!convertFile) {
      toast.error(t("upload.selectPdf"));
      return;
    }

    setConverting(true);
    setConvertProgress(0);
    setConvertStatus(t("upload.sendingPdf"));
    try {
      const { blob, fileName } = await convertPdfOnServer(convertFile, {
        baseName: "cenovnik",
        onProgress: (p) => {
          setConvertProgress(p.progress);
          const last = p.logs[p.logs.length - 1];
          if (last) setConvertStatus(last);
          else if (p.status === "processing") setConvertStatus(t("upload.renderProcessing"));
        },
      });
      downloadExcelBlob(blob, fileName);
      toast.success(t("upload.excelDownloaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("upload.convertFailed"));
    } finally {
      setConverting(false);
      setConvertProgress(0);
      setConvertStatus("");
    }
  }

  function appendTarget(formData: FormData) {
    if (priceListId) formData.append("priceListId", String(priceListId));
    formData.append("mode", mode);
  }

  async function handlePreview() {
    if (!importFile) {
      toast.error(t("upload.selectExcel"));
      return;
    }
    if (!priceListId) {
      toast.error(t("upload.noList"));
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);
    appendTarget(formData);

    setPreviewing(true);
    try {
      const res = await fetch("/api/upload/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
      toast.success(t("upload.previewReady"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("upload.previewFailed"));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) {
      toast.error(t("upload.selectExcel"));
      return;
    }
    if (!priceListId) {
      toast.error(t("upload.noList"));
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);
    appendTarget(formData);

    setImporting(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.status === 402) {
        toast.error(data.error ?? t("billing.trialExpired"));
        router.push("/settings/billing");
        return;
      }
      if (!res.ok) throw new Error(data.error);

      const total = data.inserted + data.updated;
      const skipped = data.skipped ?? 0;
      if (skipped > 0) {
        toast.success(
          t("upload.importSuccessWithSkipped", {
            total,
            parsed: data.rowCount ?? total,
            skipped,
            removed: data.removedOld ?? 0,
          }),
        );
      } else if (mode === "replace") {
        toast.success(
          t("upload.importSuccessReplace", {
            total,
            parsed: data.rowCount ?? total,
            removed: data.removedOld ?? 0,
          }),
        );
      } else {
        toast.success(
          t("upload.importSuccessMerge", {
            total,
            inserted: data.inserted ?? 0,
            updated: data.updated ?? 0,
            parsed: data.rowCount ?? total,
          }),
        );
      }
      setImportFile(null);
      setPreview(null);
      router.push("/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("upload.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  async function confirmRollback() {
    if (!priceListId) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/price-lists/${priceListId}/rollback`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? t("upload.rollbackSuccess"));
      setRollbackOpen(false);
      router.push("/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("upload.rollbackFailed"));
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <DashboardShell
      title={t("upload.title")}
      description={t("upload.description")}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {t("upload.excelTitle")}
            </CardTitle>
            <CardDescription>{t("upload.excelDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImport} className="space-y-5">
              <div className="space-y-2">
                <Label>{t("upload.targetList")}</Label>
                {lists.length > 0 ? (
                  <Select
                    value={priceListId ? String(priceListId) : undefined}
                    onValueChange={(v) => {
                      setPriceListId(Number(v));
                      setPreview(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("lists.select")} />
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={String(list.id)}>
                          {list.name}
                          {list.active ? ` · ${t("lists.activeBadge")}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("upload.noList")}{" "}
                    <Link href="/products" className="font-medium text-primary underline-offset-2 hover:underline">
                      {t("nav.products")}
                    </Link>
                  </p>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t("upload.mode")}</legend>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="import-mode"
                    className="mt-1 accent-primary"
                    checked={mode === "merge"}
                    onChange={() => {
                      setMode("merge");
                      setPreview(null);
                    }}
                  />
                  <span>
                    <span className="font-medium">{t("upload.modeMerge")}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("upload.modeMergeHint")}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="import-mode"
                    className="mt-1 accent-primary"
                    checked={mode === "replace"}
                    onChange={() => {
                      setMode("replace");
                      setPreview(null);
                    }}
                  />
                  <span>
                    <span className="font-medium">{t("upload.modeReplace")}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("upload.modeReplaceHint")}
                    </span>
                  </span>
                </label>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="import-file">{t("upload.excelFile")}</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setPreview(null);
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewing || !importFile || !priceListId}
                  className="w-full sm:w-auto"
                  onClick={() => void handlePreview()}
                >
                  {previewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {t("upload.previewDiff")}
                </Button>
                <Button
                  type="submit"
                  disabled={importing || !priceListId}
                  className="w-full sm:w-auto"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {t("upload.importDb")}
                </Button>
                {selected?.has_snapshot ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() => setRollbackOpen(true)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("upload.rollback")}
                  </Button>
                ) : null}
              </div>

              {preview ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">{t("upload.previewTitle")}</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>{t("upload.previewAdded", { count: preview.added })}</li>
                    <li>{t("upload.previewUpdated", { count: preview.updated })}</li>
                    {mode === "replace" ? (
                      <li>{t("upload.previewRemoved", { count: preview.removed })}</li>
                    ) : null}
                    <li>{t("upload.previewUnchanged", { count: preview.unchanged })}</li>
                  </ul>
                  {preview.sampleUpdated.length > 0 ? (
                    <p className="mt-3 text-xs">
                      {t("upload.priceExample", {
                        sku: preview.sampleUpdated[0].sku,
                        oldPrice: preview.sampleUpdated[0].oldPrice,
                        newPrice: preview.sampleUpdated[0].newPrice,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
              {t("upload.pdfSection")}
            </CardTitle>
            <CardDescription>
              {t("upload.pdfSectionHint")}{" "}
              <a
                href="/pdf-to-excel"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t("upload.pdfSectionLink")}
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pdfServiceOk === false ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
                {pdfLocalHoreca
                  ? t("upload.converterLocalHint")
                  : t("upload.converterUnavailable")}
              </div>
            ) : null}
            <form onSubmit={handleConvert} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setConvertFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="submit" variant="outline" disabled={converting} className="min-w-[10rem]">
                {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {converting
                  ? convertProgress > 0
                    ? t("upload.convertingPct", { pct: convertProgress })
                    : convertStatus || t("upload.converting")
                  : t("upload.downloadExcel")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={rollbackOpen}
        onOpenChange={(open) => !open && setRollbackOpen(false)}
        title={t("upload.rollbackTitle")}
        description={
          selected ? t("upload.rollbackBody", { name: selected.name }) : null
        }
        confirmLabel={t("upload.rollbackConfirm")}
        destructive
        loading={rollingBack}
        onConfirm={() => void confirmRollback()}
      />
    </DashboardShell>
  );
}
