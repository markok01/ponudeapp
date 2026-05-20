import type { ExportMode, PdfConvertJob } from "@/types/pdf-converter";

const POLL_MS = 1500;
/** Klijent čeka Render; Vercel funkcija ne drži jedan request 5+ min. */
const MAX_WAIT_MS = 25 * 60 * 1000;

export type PdfConvertProgress = {
  status: PdfConvertJob["status"];
  progress: number;
  logs: string[];
};

export async function convertPdfOnServer(
  file: File,
  options?: {
    baseName?: string;
    exportMode?: ExportMode;
    onProgress?: (p: PdfConvertProgress) => void;
  },
): Promise<{ blob: Blob; fileName: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("baseName", options?.baseName ?? "cenovnik");
  formData.append("exportMode", options?.exportMode ?? "single_sheet");

  const res = await fetch("/api/pdf-convert", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) {
    const hint =
      res.status === 503
        ? " Proverite /api/health → pdfConverter i env na Vercelu (ponudeapp projekat)."
        : "";
    throw new Error((data.error ?? "Konverzija nije uspela") + hint);
  }

  if (data.sync && data.excelBase64) {
    const bytes = Uint8Array.from(atob(data.excelBase64), (c) => c.charCodeAt(0));
    return {
      blob: new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      fileName: data.fileName ?? "document.xlsx",
    };
  }

  const jobId = data.jobId as string | undefined;
  if (!jobId) throw new Error("Konverzija nije pokrenuta (nema job ID)");

  const started = Date.now();

  while (Date.now() - started < MAX_WAIT_MS) {
    const statusRes = await fetch(`/api/pdf-convert/${jobId}`);
    const job = (await statusRes.json()) as PdfConvertJob & { error?: string };
    if (!statusRes.ok) throw new Error(job.error ?? "Greška pri čitanju statusa");

    options?.onProgress?.({
      status: job.status,
      progress: job.progress,
      logs: job.logs,
    });

    if (job.status === "completed") {
      const dlRes = await fetch(`/api/pdf-convert/${jobId}/download`);
      if (!dlRes.ok) {
        const err = await dlRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Preuzimanje nije uspelo");
      }
      const disposition = dlRes.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fileName = match?.[1] ?? job.fileName ?? "document.xlsx";
      return { blob: await dlRes.blob(), fileName };
    }

    if (job.status === "failed") {
      throw new Error(job.error ?? "Konverzija nije uspela");
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error(
    "Konverzija traje predugo. Render free plan može biti spor — sačekajte minut i pokušajte ponovo.",
  );
}

export function downloadExcelBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
