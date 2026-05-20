import type ExcelJS from "exceljs";

/** Da li je vrednost cene tačno kao u PDF-u (npr. 320.00 din/kom, 2,100.00 din/kg). */
export function isPriceLiteral(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return (
    /din\s*\/\s*(kom|kg|seta|l|ml)/i.test(v) ||
    /rsd\s*\/\s*(kom|kg|seta|l|ml)/i.test(v) ||
    /^\d[\d.,\s]*\s*(din|rsd)\s*\//i.test(v)
  );
}

/** Pakovanje: 12 kom., 2 seta */
export function isPackLiteral(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^\d+([.,]\d+)?\s*(kom|kg|seta|l|ml)\.?$/i.test(v) || /tr\.?\s*pak/i.test(v);
}

/** PDV kao u PDF-u: 20%, 10% */
export function isPdvLiteral(value: string): boolean {
  const v = value.trim();
  return /^(10|20)\s*%$/.test(v) || v === "0.1" || v === "0.2";
}

/** Upisuje ćeliju kao tekst — Excel ne menja format (bez gubljenja din/kom). */
export function writeLiteralCell(
  cell: ExcelJS.Cell,
  value: string,
  options?: { alignRight?: boolean },
): void {
  const text = value.trim() ? value : "";
  cell.value = text;
  cell.numFmt = "@";

  if (options?.alignRight) {
    cell.alignment = {
      horizontal: "right",
      vertical: "top",
      wrapText: false,
    };
  }
}

export function formatCellValue(
  cell: ExcelJS.Cell,
  value: string,
  colIndex: number,
  layout: "wide" | "compact",
): void {
  const priceCol = layout === "wide" ? 6 : 5;
  const pdvCol = layout === "wide" ? 7 : 6;
  const packCol = layout === "wide" ? 5 : 4;

  if (isPriceLiteral(value)) {
    writeLiteralCell(cell, value, { alignRight: true });
    return;
  }

  if (colIndex === packCol && isPackLiteral(value)) {
    writeLiteralCell(cell, value);
    return;
  }

  if (colIndex === pdvCol && isPdvLiteral(value)) {
    const display = value.trim().endsWith("%") ? value.trim() : value;
    writeLiteralCell(cell, display, { alignRight: true });
    return;
  }

  cell.value = value;
}
