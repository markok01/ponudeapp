import type { HorecaExcelRow, HorecaLayout } from "@/utils/horeca-excel-styles";
import { isHeaderRowCells } from "@/utils/price-list-columns";

export interface HorecaSheetLike {
  name: string;
  layout: HorecaLayout;
  rows: HorecaExcelRow[];
}

const MASHED_HEADER_RE =
  /šifra.*artikal.*(tr\.?\s*pak|p\.?\s*c|pdv)/i;

function isMashedHeaderRow(cells: string[]): boolean {
  const nonEmpty = cells.filter((c) => c?.trim());
  if (nonEmpty.length >= 4) return false;
  const joined = nonEmpty.join("").replace(/\s+/g, "");
  return MASHED_HEADER_RE.test(joined) || joined.length > 28 && /šifra/i.test(joined) && /pdv/i.test(joined);
}

/** Odbaci loš parse (pdf-parse tekst) pre nego što user dobije pokvaren Excel. */
export function validateHorecaParseResult(
  sheets: HorecaSheetLike[],
  productCount: number,
  options?: { minProducts?: number; strictCenovnik?: boolean },
): void {
  const minProducts = options?.minProducts ?? (options?.strictCenovnik ? 100 : 1);

  if (!sheets.length) {
    throw new Error("PDF nije prepoznat — nema tabela. Koristite originalni .xlsx ili PDF converter servis.");
  }

  if (productCount < minProducts) {
    throw new Error(
      `Prepoznato samo ${productCount} proizvoda (očekivano ≥${minProducts}). ` +
        "PDF tabela nije ispravno izvučena — koristite .xlsx ili pdfplumber servis.",
    );
  }

  let sawHeader = false;
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      if (row.kind !== "header") continue;
      sawHeader = true;
      if (isMashedHeaderRow(row.cells)) {
        throw new Error(
          "Kolone u PDF-u nisu ispravno razdvojene (spojeno zaglavlje). " +
            "Koristite pdfplumber (docker compose up pdf-converter) ili originalni .xlsx.",
        );
      }
      const nonEmpty = row.cells.filter((c) => c?.trim());
      if (!isHeaderRowCells(nonEmpty) && nonEmpty.length < 4) {
        throw new Error(
          "Zaglavlje tabele nije prepoznato. PDF zahteva pdfplumber parser, ne plain tekst.",
        );
      }
    }
  }

  if (options?.strictCenovnik && !sawHeader) {
    throw new Error("Nije pronađen header red (šifra, artikal, p.c., PDV). Proverite PDF ili koristite .xlsx.");
  }
}
