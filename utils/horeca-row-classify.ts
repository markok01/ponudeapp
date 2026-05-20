import {
  isBrandRow,
  isHeaderRowCells,
  isLikelyPriceRaw,
  isPackColumn,
  parsePriceHint,
} from "@/utils/price-list-columns";
import type { HorecaLayout, HorecaRowKind } from "@/utils/horeca-excel-styles";

export function cleanCell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeRowCells(raw: unknown[], targetCols: number): string[] {
  const cells = raw.map(cleanCell);
  while (cells.length < targetCols) cells.push("");
  return cells.slice(0, targetCols);
}

export function detectLayoutFromHeader(cells: string[]): HorecaLayout {
  const lower = cells.join(" ").toLowerCase();
  const artikalCount = (lower.match(/artikal|artiakal/g) || []).length;
  return artikalCount >= 2 || cells.length >= 7 ? "wide" : "compact";
}

export function isTitleRow(cells: string[]): boolean {
  const text = cells.filter(Boolean).join(" ").toLowerCase();
  return text.includes("horeca") && text.includes("cenovnik");
}

export function isNoteRow(cells: string[]): boolean {
  const text = cells.filter(Boolean).join(" ").toLowerCase();
  return text.includes("cene su iskazane") || text.includes("bez pdv");
}

/** Naziv brenda/sekcije za merge red (jedna ćelija). */
export function extractBrandLabel(cells: string[]): string {
  const nonEmpty = cells.map(cleanCell).filter(Boolean);
  if (nonEmpty.length === 0) return "";

  const upperFirst = nonEmpty[0].toUpperCase();
  if (nonEmpty.every((c) => c.toUpperCase() === upperFirst)) {
    return nonEmpty[0];
  }

  const nameCol = cells[2]?.trim() || cells[3]?.trim();
  if (nameCol && !cells[0]?.trim() && !cells[1]?.trim()) {
    return nameCol;
  }

  return nonEmpty[0];
}

/** Pod-sekcija (MEGGLE UVOZ) — u PDF-u je ljubičast header, ne bold proizvod. */
export function isSectionBrandRow(
  cells: string[],
  layout: HorecaLayout,
): string | null {
  const priceCol = layout === "wide" ? 5 : 4;
  const sifra = cells[0]?.trim() ?? "";
  const nova = cells[1]?.trim() ?? "";
  const name = cells[2]?.trim() || cells[3]?.trim() || "";
  const priceRaw = cells[priceCol] ?? "";

  if (parsePriceHint(priceRaw) != null || isLikelyPriceRaw(priceRaw)) return null;
  if (/^\d{3,}$/.test(sifra) || /^\d{4,}$/.test(nova)) return null;
  if (!name || name.length < 2) return null;
  if (/^(šifra|sifra|artikal|artiakal|p\.?\s*c|pdv|tr\.pak)/i.test(name)) return null;
  if (isPackColumn(name)) return null;

  const c3 = cells[3]?.trim() ?? "";
  if (c3 && c3.toUpperCase() === name.toUpperCase()) return name;
  if (!sifra && !nova) return name;

  return null;
}

export function normalizeBrandRowCells(label: string, layout: HorecaLayout): string[] {
  const cols = layout === "wide" ? 7 : 6;
  const cells = new Array<string>(cols).fill("");
  cells[0] = label;
  return cells;
}

export function classifyHorecaRow(cells: string[], layout: HorecaLayout): HorecaRowKind {
  const colCount = layout === "wide" ? 7 : 6;
  const normalized = normalizeRowCells(cells, colCount);
  const nonEmpty = normalized.filter(Boolean);

  if (nonEmpty.length === 0) return "raw";
  if (isTitleRow(normalized) || isNoteRow(normalized)) return "title";

  if (isHeaderRowCells(normalized) && nonEmpty.length >= 3) return "header";

  const brandName = isBrandRow(normalized);
  if (brandName) {
    return "brand";
  }

  const section = isSectionBrandRow(normalized, layout);
  if (section) {
    return "brand";
  }

  const priceCol = layout === "wide" ? 5 : 4;
  const priceRaw = normalized[priceCol] ?? "";
  const name = normalized[2] ?? normalized[3] ?? "";

  if (parsePriceHint(priceRaw) != null && !isPackColumn(name)) {
    return "product";
  }

  if (nonEmpty.length === 1 && nonEmpty[0].length > 2 && !/^\d+$/.test(nonEmpty[0])) {
    return "brand";
  }

  return "raw";
}

/** Vrati ćelije spremne za export (brend = samo label u A). */
export function cellsForExport(
  kind: HorecaRowKind,
  cells: string[],
  layout: HorecaLayout,
): string[] {
  if (kind === "brand") {
    return normalizeBrandRowCells(extractBrandLabel(cells), layout);
  }
  if (kind === "header") {
    return layout === "wide"
      ? ["šifra", "ova šifr", "artikal", "artikal", "tr.pak.", "p.c.", "PDV"]
      : ["šifra", "ova šifr", "artikal", "tr.pak.", "p.c.", "PDV"];
  }
  return cells;
}
