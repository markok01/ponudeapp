"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  Eye,
  FileSpreadsheet,
  FileUp,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ImportHistoryPanel } from "@/components/upload/import-history-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertPdfOnServer, downloadExcelBlob } from "@/lib/client-pdf-convert";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { ImportPreviewDiff } from "@/types";

export default function UploadPage() {
  const t = useTranslations();
  const router = useRouter();

  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertStatus, setConvertStatus] = useState("");

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState(t("upload.defaultListName"));
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewDiff | null>(null);

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

  async function handlePreview() {
    if (!importFile) {
      toast.error(t("upload.selectExcel"));
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);

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

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("name", importName);

    setImporting(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(
        t("upload.importSuccess", {
          total: data.inserted + data.updated,
          removed: data.removedOld ?? 0,
        }),
      );
      setImportFile(null);
      setPreview(null);
      router.push("/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("upload.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <DashboardShell
      title={t("upload.title")}
      description={t("upload.description")}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-6">
        <ImportHistoryPanel />

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
                <Label htmlFor="import-name">{t("upload.listName")}</Label>
                <Input
                  id="import-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                />
              </div>
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewing || !importFile}
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
                <Button type="submit" disabled={importing} className="w-full sm:w-auto">
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {t("upload.importDb")}
                </Button>
              </div>

              {preview ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">{t("upload.previewTitle")}</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>{t("upload.previewAdded", { count: preview.added })}</li>
                    <li>{t("upload.previewUpdated", { count: preview.updated })}</li>
                    <li>{t("upload.previewRemoved", { count: preview.removed })}</li>
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
    </DashboardShell>
  );
}
