"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import { ConversionProgress } from "@/components/pdf-to-excel/conversion-progress";
import { DataPreview } from "@/components/pdf-to-excel/data-preview";
import { ExportOptions } from "@/components/pdf-to-excel/export-options";
import { PdfDropZone } from "@/components/pdf-to-excel/pdf-drop-zone";
import type { ExportMode, PdfConvertJob } from "@/types/pdf-converter";

const POLL_INTERVAL_MS = 1200;

export function PdfConverterPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [baseName, setBaseName] = useState("document");
  const [exportMode, setExportMode] = useState<ExportMode>("multiple_sheets");
  const [job, setJob] = useState<PdfConvertJob | null>(null);
  const [converting, setConverting] = useState(false);
  const [serviceOk, setServiceOk] = useState<boolean | null>(null);
  const [horecaExcelBase64, setHorecaExcelBase64] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/pdf-convert");
      const data = await res.json();
      setServiceOk(data.available === true);
    } catch {
      setServiceOk(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/pdf-convert/${jobId}`);
          const data: PdfConvertJob = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Greška");

          setJob(data);

          if (data.status === "completed") {
            stopPolling();
            setConverting(false);
            toast.success(`Excel spreman: ${data.rowCount ?? 0} redova, ${data.sheetCount ?? 0} sheet(ova)`);
          } else if (data.status === "failed") {
            stopPolling();
            setConverting(false);
            toast.error(data.error ?? "Konverzija nije uspela");
          }
        } catch (error) {
          stopPolling();
          setConverting(false);
          toast.error(error instanceof Error ? error.message : "Greška pri praćenju statusa");
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleConvert() {
    if (!file) {
      toast.error("Izaberite PDF fajl");
      return;
    }

    setConverting(true);
    setJob(null);
    setHorecaExcelBase64(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("exportMode", exportMode);
    formData.append("baseName", baseName || "document");

    try {
      const res = await fetch("/api/pdf-convert", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.sync && data.excelBase64) {
        setHorecaExcelBase64(data.excelBase64);
        setJob({
          jobId: data.jobId,
          status: "completed",
          progress: 100,
          logs: ["HoReCa parser: pdfplumber", `Proizvoda: ${data.rowCount ?? 0}`],
          fileName: data.fileName,
          rowCount: data.rowCount,
          sheetCount: data.sheetCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setConverting(false);
        toast.success(
          `HoReCa Excel spreman: ${data.rowCount ?? 0} proizvoda, ${data.sheetCount ?? 0} sheet(ova)`,
        );
        return;
      }

      toast.message("Konverzija pokrenuta");

      const fetchStatus = async () => {
        const statusRes = await fetch(`/api/pdf-convert/${data.jobId}`);
        const statusData: PdfConvertJob = await statusRes.json();
        if (statusRes.ok) setJob(statusData);
        return statusData;
      };

      const first = await fetchStatus();
      if (first.status === "completed" || first.status === "failed") {
        setConverting(false);
        if (first.status === "completed") {
          toast.success(`Excel spreman: ${first.rowCount ?? 0} redova`);
        } else {
          toast.error(first.error ?? "Konverzija nije uspela");
        }
        return;
      }

      pollJob(data.jobId);
    } catch (error) {
      setConverting(false);
      toast.error(error instanceof Error ? error.message : "Upload nije uspeo");
    }
  }

  async function handleDownload() {
    if (!job?.jobId) return;
    try {
      if (horecaExcelBase64) {
        const bytes = Uint8Array.from(atob(horecaExcelBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = job.fileName ?? "horeca-cenovnik.xlsx";
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Excel preuzet");
        return;
      }

      const res = await fetch(`/api/pdf-convert/${job.jobId}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Preuzimanje nije uspelo");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = job.fileName ?? "document.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel preuzet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preuzimanje nije uspelo");
    }
  }

  function handleReset() {
    stopPolling();
    setFile(null);
    setJob(null);
    setHorecaExcelBase64(null);
    setConverting(false);
  }

  const status = job?.status ?? (converting ? "processing" : "idle");
  const progress = job?.progress ?? (converting ? 5 : 0);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-4 sm:gap-6">
      {serviceOk === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          HoReCa cenovnik radi lokalno (potreban <code className="text-xs">python3</code> +{" "}
          <code className="text-xs">pip install pdfplumber</code>). Za ostale PDF-ove:{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">docker compose up pdf-converter</code>
        </div>
      )}

      <Card className="border-primary/15 overflow-hidden">
        <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                PDF → Excel konverter
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-xl">
                Profesionalna ekstrakcija tabela iz bilo kog PDF-a — fakture, cenovnici,
                bankovni izvodi, više stranica i više tabela.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={checkHealth} className="shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="base-name">Naziv Excel fajla</Label>
            <Input
              id="base-name"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value.replace(/[^\w\-]/g, "_"))}
              placeholder="document"
              disabled={converting}
            />
          </div>

          <PdfDropZone file={file} onFileSelect={setFile} disabled={converting} />

          <div className="space-y-2">
            <Label>Način exporta</Label>
            <ExportOptions value={exportMode} onChange={setExportMode} disabled={converting} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <Button onClick={handleConvert} disabled={converting || !file} className="w-full sm:w-auto sm:min-w-[160px]">
              {converting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Konvertujem...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  Konvertuj u Excel
                </>
              )}
            </Button>

            {job?.status === "completed" && (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Preuzmi Excel
              </Button>
            )}

            {(job || file) && !converting && (
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleReset}>
                Novi dokument
              </Button>
            )}
          </div>

          <ConversionProgress
            status={status as "idle" | typeof status}
            progress={progress}
            logs={job?.logs ?? []}
          />

          {job?.preview && job.status === "completed" && (
            <div className="space-y-3 border-t border-border/40 pt-6">
              <h3 className="text-sm font-semibold">Pregled ekstrahovanih podataka</h3>
              <DataPreview preview={job.preview} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
