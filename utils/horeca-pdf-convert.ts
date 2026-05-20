import { spawn } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { HorecaExcelRow, HorecaLayout, HorecaRowKind } from "@/utils/horeca-excel-styles";
import { exportHorecaWorkbook } from "@/utils/horeca-excel-export";

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
        reject(new Error(stderr || `horeca-from-pdf.py exited with ${code}`));
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

export async function convertHorecaPdfToExcel(
  buffer: Buffer,
  baseName: string,
): Promise<{
  excelBuffer: Buffer;
  fileName: string;
  productCount: number;
  sheetCount: number;
}> {
  const dir = await mkdtemp(join(tmpdir(), "horeca-pdf-"));
  const pdfPath = join(dir, "input.pdf");

  try {
    await writeFile(pdfPath, buffer);
    const { sheets, productCount } = await runHorecaPdfScript(pdfPath);

    if (!sheets.length || productCount < 1) {
      throw new Error(
        "HoReCa PDF nije prepoznat ili nema proizvoda. Koristite originalni .xlsx cenovnik.",
      );
    }

    const excelBuffer = await exportHorecaWorkbook(
      sheets.map((s) => ({
        name: s.name,
        layout: s.layout,
        rows: s.rows as HorecaExcelRow[],
      })),
    );

    const safeName = baseName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "horeca-cenovnik";
    return {
      excelBuffer,
      fileName: `${safeName}.xlsx`,
      productCount,
      sheetCount: sheets.length,
    };
  } finally {
    await unlink(pdfPath).catch(() => {});
  }
}

export function isLikelyHorecaFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.includes("horeca") ||
    lower.includes("cenovnik") ||
    lower.includes("silbo")
  );
}
