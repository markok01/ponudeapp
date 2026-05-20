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
import type { ImportPreviewDiff } from "@/types";

export default function UploadPage() {
  const router = useRouter();

  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertStatus, setConvertStatus] = useState("");

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState("Cenovnik");
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewDiff | null>(null);

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!convertFile) {
      toast.error("Izaberite PDF");
      return;
    }

    setConverting(true);
    setConvertProgress(0);
    setConvertStatus("Šaljem PDF na Render…");
    try {
      const { blob, fileName } = await convertPdfOnServer(convertFile, {
        baseName: "cenovnik",
        onProgress: (p) => {
          setConvertProgress(p.progress);
          const last = p.logs[p.logs.length - 1];
          if (last) setConvertStatus(last);
          else if (p.status === "processing") setConvertStatus("Render obrađuje PDF…");
        },
      });
      downloadExcelBlob(blob, fileName);
      toast.success("Excel preuzet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Konverzija nije uspela");
    } finally {
      setConverting(false);
      setConvertProgress(0);
      setConvertStatus("");
    }
  }

  async function handlePreview() {
    if (!importFile) {
      toast.error("Izaberite Excel (.xlsx)");
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
      toast.success("Pregled spreman");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pregled nije uspeo");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) {
      toast.error("Izaberite Excel (.xlsx)");
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
        `Cenovnik zamenjen: ${data.inserted + data.updated} proizvoda (uklonjeno ${data.removedOld ?? 0} starih).`,
      );
      setImportFile(null);
      setPreview(null);
      router.push("/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uvoz nije uspeo");
    } finally {
      setImporting(false);
    }
  }

  return (
    <DashboardShell
      title="Upload cenovnika"
      description="Uvezite Excel cenovnik u bazu. PDF se može pretvoriti u Excel pre uvoza."
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-6">
        <ImportHistoryPanel />

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Uvoz Excel cenovnika
            </CardTitle>
            <CardDescription>
              Preporučeno: uvezite .xlsx fajl (HoReCa format). Stari katalog se zamenjuje
              novim — snapshot pre uvoza omogućava rollback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImport} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="import-name">Naziv cenovnika</Label>
                <Input
                  id="import-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-file">Excel (.xlsx)</Label>
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
                  Pregled diff-a
                </Button>
                <Button type="submit" disabled={importing} className="w-full sm:w-auto">
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  Uvezi u bazu
                </Button>
              </div>

              {preview ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Pregled pre primene</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>Novo: {preview.added}</li>
                    <li>Ažurirano: {preview.updated}</li>
                    <li>Uklonjeno iz aktivnog kataloga: {preview.removed}</li>
                    <li>Bez izmene: {preview.unchanged}</li>
                  </ul>
                  {preview.sampleUpdated.length > 0 ? (
                    <p className="mt-3 text-xs">
                      Primer cene: {preview.sampleUpdated[0].sku} —{" "}
                      {preview.sampleUpdated[0].oldPrice} → {preview.sampleUpdated[0].newPrice} RSD
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
              PDF → Excel (opciono)
            </CardTitle>
            <CardDescription>
              Prvi put na Render free može trajati 1–2 min (servis se budi). U Render
              Logs treba da se vidi{" "}
              <code className="text-xs">POST /api/v1/convert</code>. HoReCa cenovnik:
              specijalni parser. Za ostalo koristite{" "}
              <a
                href="/pdf-to-excel"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                PDF → Excel
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
                    ? `Konverzija ${convertProgress}%`
                    : convertStatus || "Konverzija…"
                  : "Preuzmi Excel"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
