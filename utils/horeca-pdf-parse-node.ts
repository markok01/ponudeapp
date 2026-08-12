/**
 * HoReCa PDF → sheet rows u Node.js (Vercel, bez Python/pdfplumber).
 * Koristi pdf-parse tekst; za skenirane PDF-ove i dalje treba PDF_CONVERTER_URL.
 */
import type { HorecaExcelRow, HorecaLayout, HorecaRowKind } from "@/utils/horeca-excel-styles";
import {
  classifyHorecaRow,
  cleanCell,
  detectLayoutFromHeader,
  extractBrandLabel,
  normalizeBrandRowCells,
  normalizeRowCells,
} from "@/utils/horeca-row-classify";
import { isHeaderRowCells } from "@/utils/price-list-columns";
import { extractPdfText } from "@/utils/price-list-parse";

export interface HorecaPdfSheet {
  name: string;
  layout: HorecaLayout;
  rows: HorecaExcelRow[];
}

function splitLineToCells(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => cleanCell(c));
  }
  const parts = line.split(/\s{2,}/).map((c) => cleanCell(c)).filter(Boolean);
  if (parts.length >= 4) return parts;
  return line.split(/\s+/).map((c) => cleanCell(c));
}

function normalizeTableRow(raw: string[], layout: HorecaLayout): string[] {
  const cols = layout === "wide" ? 7 : 6;
  const cells = raw.map((c) => cleanCell(c));
  while (cells.length < cols) cells.push("");
  const norm = cells.slice(0, cols);
  if (layout === "wide" && norm[2] && !norm[3]) {
    norm[3] = norm[2];
  }
  return norm;
}

function classifyRow(cells: string[], layout: HorecaLayout): HorecaRowKind {
  const kind = classifyHorecaRow(cells, layout);
  if (kind === "brand") {
    return "brand";
  }
  return kind;
}

export async function parseHorecaPdfNode(buffer: Buffer): Promise<{
  sheets: HorecaPdfSheet[];
  productCount: number;
}> {
  const text = await extractPdfText(buffer);
  if (!text.trim()) {
    throw new Error("PDF nema čitljiv tekst (skenirana slika). Koristite .xlsx ili PDF converter servis.");
  }

  const lowerAll = text.toLowerCase();
  if (!lowerAll.includes("horeca") && !lowerAll.includes("cenovnik") && !lowerAll.includes("šifra")) {
    throw new Error("PDF ne izgleda kao HoReCa cenovnik.");
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  let layout: HorecaLayout = "compact";
  const rows: HorecaExcelRow[] = [];

  for (const line of lines) {
    const rawCells = splitLineToCells(line);
    if (!rawCells.some(Boolean)) continue;

    if (isHeaderRowCells(rawCells) && rawCells.filter(Boolean).length >= 3) {
      layout = detectLayoutFromHeader(rawCells);
    }

    const norm = normalizeTableRow(rawCells, layout);
    const kind = classifyRow(norm, layout);

    let cells = norm;
    if (kind === "brand") {
      cells = normalizeBrandRowCells(extractBrandLabel(norm), layout);
    }

    rows.push({ kind, cells, layout });
  }

  const productCount = rows.filter((r) => r.kind === "product").length;
  if (productCount < 1) {
    throw new Error(
      "HoReCa PDF nije prepoznat iz teksta. Koristite originalni .xlsx ili PDF_CONVERTER_URL na Vercelu.",
    );
  }

  return {
    sheets: [{ name: "Cenovnik", layout, rows }],
    productCount,
  };
}
