import type ExcelJS from "exceljs";
import { HORECA_BRAND_FILL, HORECA_HEADER_FILL } from "@/utils/horeca-excel-styles";
import { extractBrandLabel } from "@/utils/horeca-row-classify";
import {
  isHeaderRowCells,
  isPureColumnHeaderRow,
  rowLooksLikeProductLine,
} from "@/utils/price-list-columns";

function normalizeArgb(argb?: string): string {
  if (!argb) return "";
  return argb.replace(/^#/, "").toUpperCase();
}

function cellFillArgb(cell: ExcelJS.Cell): string {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern") return "";
  const fg = (fill as ExcelJS.FillPattern).fgColor;
  return normalizeArgb(fg?.argb);
}

function isWhiteFont(argb?: string): boolean {
  const a = normalizeArgb(argb);
  if (!a) return false;
  return a === "FFFFFFFF" || a.endsWith("FFFFFF");
}

function isHorecaBrandFill(argb: string): boolean {
  if (!argb) return false;
  const brand = normalizeArgb(HORECA_BRAND_FILL);
  return argb === brand || argb.includes("B09FC6");
}

function isHorecaHeaderFill(argb: string): boolean {
  if (!argb) return false;
  const header = normalizeArgb(HORECA_HEADER_FILL);
  return argb === header || argb.includes("CCC0DA");
}

function isMostlyUppercaseLabel(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  const letters = t.replace(/[^a-zA-ZÀ-žČĆŠĐŽ]/g, "");
  if (!letters) return false;
  const upper = t.replace(/[^A-ZÀ-ŽČĆŠĐŽ]/g, "");
  return upper.length / letters.length >= 0.85;
}

/** Tekst iz ćelije (uključujući richText i master pri merge-u). */
export function excelCellText(cell: ExcelJS.Cell): string {
  const source = cell.isMerged && cell.master ? cell.master : cell;
  const v = source.value;

  if (v != null && typeof v === "object" && "richText" in v) {
    const rich = v as { richText: { text: string }[] };
    const fromRich = rich.richText.map((t) => t.text).join("").trim();
    if (fromRich) return fromRich;
  }

  const text = source.text?.trim();
  if (text && text !== "[object Object]") return text;

  if (v == null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && "result" in v) {
    return String((v as { result?: unknown }).result ?? "").trim();
  }
  if (typeof v === "object" && "text" in v) {
    return String((v as { text: string }).text ?? "").trim();
  }
  return "";
}

/** Svi tekstovi u redu (za merge / brend u koloni C). */
export function readExcelRowTexts(row: ExcelJS.Row, maxCol = 10): string[] {
  const out: string[] = [];
  for (let col = 1; col <= maxCol; col++) {
    const t = excelCellText(row.getCell(col));
    if (t) out.push(t);
  }
  return out;
}

function rowStyleSignals(row: ExcelJS.Row, maxCol: number): {
  hasBrandFill: boolean;
  hasHeaderFill: boolean;
  centered: boolean;
  bold: boolean;
  whiteFont: boolean;
} {
  let hasBrandFill = false;
  let hasHeaderFill = false;
  let centeredCells = 0;
  let styledCells = 0;
  let bold = false;
  let whiteFont = false;

  for (let col = 1; col <= maxCol; col++) {
    const cell = row.getCell(col);
    const fill = cellFillArgb(cell);
    if (isHorecaBrandFill(fill)) hasBrandFill = true;
    if (isHorecaHeaderFill(fill)) hasHeaderFill = true;

    if (fill || cell.font?.bold || cell.font?.color?.argb) {
      styledCells += 1;
      if (cell.font?.bold) bold = true;
      if (isWhiteFont(cell.font?.color?.argb)) whiteFont = true;
      if (cell.alignment?.horizontal === "center") centeredCells += 1;
    }
  }

  return {
    hasBrandFill,
    hasHeaderFill,
    centered: styledCells > 0 && centeredCells >= Math.max(1, Math.ceil(styledCells / 2)),
    bold,
    whiteFont,
  };
}

function isValidBrandLabel(label: string): boolean {
  const t = label.trim();
  if (t.length < 2 || t.length >= 80) return false;
  if (/^\d+$/.test(t)) return false;
  if (/^(šifra|sifra|artikal|artiakal|tr\.pak|p\.?\s*c|pdv)$/i.test(t)) return false;
  if (/din\s*\//i.test(t)) return false;
  return true;
}

function labelFromBrandRow(row: ExcelJS.Row, cells: string[]): string | null {
  const fromCells = extractBrandLabel(cells);
  if (fromCells && isValidBrandLabel(fromCells)) return fromCells;

  const texts = readExcelRowTexts(row, 10);
  const candidates = texts.filter((t) => isValidBrandLabel(t));

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const upperFirst = candidates[0].toUpperCase();
  if (candidates.every((c) => c.toUpperCase() === upperFirst)) {
    return candidates[0];
  }

  return candidates.find((t) => isMostlyUppercaseLabel(t)) ?? candidates[0];
}

/**
 * Brend red u HoReCa Excel-u: ljubičasta pozadina (#B09FC6), beli bold font,
 * centriran tekst velikim slovima (kao u PDF / našem exportu).
 */
export function detectHorecaBrandFromExcelRow(
  row: ExcelJS.Row,
  cells: string[],
  sifra: string,
  novaSifra: string,
  name: string,
  price: number | null,
): string | null {
  const cellList = cells.filter((c) => c.trim() !== "");
  if (cellList.length === 0) return null;
  if (isPureColumnHeaderRow(cellList) || isHeaderRowCells(cellList)) return null;
  if (rowLooksLikeProductLine(sifra, novaSifra, name, price)) return null;

  const signals = rowStyleSignals(row, 10);
  if (signals.hasHeaderFill && !signals.hasBrandFill) return null;

  const label = labelFromBrandRow(row, cells);
  if (!label) {
    if (signals.hasBrandFill) return null;
    return null;
  }

  if (signals.hasBrandFill) return label;

  if (
    signals.whiteFont &&
    signals.bold &&
    signals.centered &&
    isMostlyUppercaseLabel(label)
  ) {
    return label;
  }

  return null;
}
