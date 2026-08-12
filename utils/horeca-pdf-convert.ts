import { spawn } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { allowWeakPdfTextParse } from "@/lib/pdf-convert-errors";
import type { HorecaExcelRow, HorecaLayout, HorecaRowKind } from "@/utils/horeca-excel-styles";
import { exportHorecaWorkbook } from "@/utils/horeca-excel-export";
import { validateHorecaParseResult } from "@/utils/horeca-pdf-validate";
import { parseHorecaPdfNode } from "@/utils/horeca-pdf-parse-node";
import { parseExcelBuffer } from "@/utils/price-list-parse";

interface PythonSheet {
  name: string;
  layout: HorecaLayout;
  rows: { kind: HorecaRowKind; cells: string[]; layout: HorecaLayout }[];
}

async function runHorecaPdfScript(pdfPath: string): Promise<{
  sheets: PythonSheet[];
  productCount: number;
}> {
  const scriptPath = join(process.cwd(), "scripts", "horeca-from-pdf.py");

  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [scriptPath, pdfPath], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              `horeca-from-pdf.py nije uspeo (code ${code}). Instalirajte: pip install pdfplumber`,
          ),
        );
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      } catch {
        reject(new Error("Invalid JSON from horeca-from-pdf.py"));
      }
    });
  });
}

async function parseHorecaPdfWithPython(buffer: Buffer): Promise<{
  sheets: PythonSheet[];
  productCount: number;
}> {
  const dir = await mkdtemp(join(tmpdir(), "horeca-pdf-"));
  const pdfPath = join(dir, "input.pdf");

  try {
    await writeFile(pdfPath, buffer);
    return await runHorecaPdfScript(pdfPath);
  } finally {
    await unlink(pdfPath).catch(() => {});
  }
}

async function parseHorecaPdf(buffer: Buffer): Promise<{
  sheets: PythonSheet[];
  productCount: number;
}> {
  const onVercel = Boolean(process.env.VERCEL);

  if (onVercel) {
    throw new Error(
      "HoReCa PDF na produkciji zahteva PDF_CONVERTER_URL (Python servis). Lokalni pdfplumber nije dostupan na Vercelu.",
    );
  }

  try {
    return await parseHorecaPdfWithPython(buffer);
  } catch (pythonError) {
    if (!allowWeakPdfTextParse()) {
      throw new Error(
        `${pythonError instanceof Error ? pythonError.message : "Python parser failed"}. ` +
          "Pokrenite: npm run pdf-converter:docker ili pip install pdfplumber. " +
          "Za test samo tekst-parser: ALLOW_WEAK_PDF_PARSE=1 (loš kvalitet).",
      );
    }
    console.warn("[horeca-pdf] python failed, weak text fallback:", pythonError);
    const node = await parseHorecaPdfNode(buffer);
    return { sheets: node.sheets, productCount: node.productCount };
  }
}

export async function convertHorecaPdfToExcel(
  buffer: Buffer,
  baseName: string,
  options?: { strictCenovnik?: boolean },
): Promise<{
  excelBuffer: Buffer;
  fileName: string;
  productCount: number;
  sheetCount: number;
}> {
  const { sheets, productCount } = await parseHorecaPdf(buffer);

  validateHorecaParseResult(
    sheets.map((s) => ({
      name: s.name,
      layout: s.layout,
      rows: s.rows as HorecaExcelRow[],
    })),
    productCount,
    {
      minProducts: options?.strictCenovnik ? 100 : 1,
      strictCenovnik: options?.strictCenovnik,
    },
  );

  const excelBuffer = await exportHorecaWorkbook(
    sheets.map((s) => ({
      name: s.name,
      layout: s.layout,
      rows: s.rows as HorecaExcelRow[],
    })),
  );

  if (options?.strictCenovnik) {
    const importRows = await parseExcelBuffer(excelBuffer);
    if (importRows.length < 100) {
      throw new Error(
        `Excel iz PDF-a nije prepoznat kao cenovnik (${importRows.length} proizvoda). Koristite originalni .xlsx.`,
      );
    }
  }

  const safeName = baseName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "horeca-cenovnik";
  return {
    excelBuffer,
    fileName: `${safeName}.xlsx`,
    productCount,
    sheetCount: sheets.length,
  };
}

export function isLikelyHorecaFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.includes("horeca") ||
    lower.includes("cenovnik") ||
    lower.includes("silbo")
  );
}

/** Lokalna sync HoReCa konverzija (pdfplumber) — samo kada nema remote servisa. */
export async function tryLocalHorecaPdfToExcel(
  buffer: Buffer,
  baseName: string,
  filename: string,
): Promise<{
  excelBuffer: Buffer;
  fileName: string;
  productCount: number;
  sheetCount: number;
} | null> {
  if (process.env.VERCEL) return null;
  if (!isLikelyHorecaFile(filename) && !baseName.toLowerCase().includes("cenovnik")) {
    return null;
  }
  try {
    return await convertHorecaPdfToExcel(buffer, baseName, { strictCenovnik: true });
  } catch (error) {
    console.warn("[horeca-pdf] local sync failed:", error);
    return null;
  }
}
