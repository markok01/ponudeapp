import ExcelJS from "exceljs";
import type { PriceListImportResult, PriceListRow } from "@/types/price-list";
import {
  catalogHeaderRowValues,
  catalogRowToExcelValues,
  logCatalogImportDebug,
  validateCatalogImportRow,
  type CatalogImportWarning,
} from "@/utils/catalog-excel";
import {
  buildHeaderMap,
  detectBrandMarkerRow,
  HORECA_COMPACT_COLS,
  isPureColumnHeaderRow,
  HORECA_WIDE_COLS,
  isHeaderRowCells,
  isLikelyPriceRaw,
  rowLooksLikeProductLine,
  isPackColumn,
  isPdvColumnRaw,
  isPdvValueAsPrice,
  isSubBrandRow,
  normalizeHeaderKey,
  parsePdvPercent,
  parsePriceHint,
  resolveSku,
  sanitizePriceListRow,
  type ColumnKind,
} from "@/utils/price-list-columns";
import { detectHorecaBrandFromExcelRow, excelCellText } from "@/utils/horeca-excel-brand-detect";
import {
  classifyHorecaRow,
  detectLayoutFromHeader,
  extractBrandLabel,
} from "@/utils/horeca-row-classify";
import type { HorecaLayout } from "@/utils/horeca-excel-styles";

export function parsePrice(value: string): number | null {
  return parsePriceHint(value);
}

function cellValue(cell: ExcelJS.Cell): string {
  return excelCellText(cell);
}

function getCell(row: ExcelJS.Row, col?: number): string {
  if (!col) return "";
  return cellValue(row.getCell(col));
}

/** Vrednosti po indeksu kolone (0 = kolona A) za ispravno mapiranje headera. */
function readRowCells(row: ExcelJS.Row, maxCol = 12): string[] {
  const cells: string[] = Array.from({ length: maxCol }, () => "");
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col >= 1 && col <= maxCol) cells[col - 1] = cellValue(cell);
  });
  return cells;
}

function rowFromParts(
  parts: string[],
  categoryIndex?: number,
): PriceListRow | null {
  if (parts.length < 2) return null;

  let sku: string;
  let name: string;
  let priceRaw: string;
  let category: string | null = null;

  if (parts.length >= 3) {
    sku = parts[0];
    priceRaw = parts[parts.length - 1];
    const nameParts = parts.slice(1, -1);
    if (categoryIndex != null && categoryIndex > 0 && categoryIndex < nameParts.length + 1) {
      category = nameParts[categoryIndex - 1] || null;
      nameParts.splice(categoryIndex - 1, 1);
    }
    name = nameParts.join(" ").trim();
  } else {
    sku = parts[0];
    priceRaw = parts[1];
    name = parts[0];
  }

  if (!name) name = sku;

  const price = parsePrice(priceRaw);
  if (!sku || !name || price == null) return null;

  return { sku, name, category, price };
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  const hasSku = /\b(sku|šifra|sifra)\b/.test(lower);
  const hasName = /\b(naziv|name|artikal|proizvod)\b/.test(lower);
  const hasPrice = /\b(cena|price|p\.?\s*c\.?|pc)\b/.test(lower);
  return hasSku && hasName && hasPrice;
}

function isHeaderCell(cell: string): boolean {
  const key = normalizeHeaderKey(cell);
  return ["sku", "sifra", "name", "naziv", "artikal", "price", "cena", "pc", "pdv", "category", "kategorija", "brend"].includes(
    key,
  );
}

/** Cena na kraju reda — podržava 1.234,56 / 1234.56 / 1 234,00 */
const TRAILING_PRICE_RE =
  /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:rsd|din|kn|€|eur)?\s*$/i;

function parseLineToRow(line: string): PriceListRow | null {
  if (isHeaderLine(line)) return null;
  const headerParts = line.split(/[\t;|]/).map((p) => p.trim());
  if (
    headerParts.length >= 2 &&
    headerParts.every((p) => isHeaderCell(p) || p === "")
  ) {
    return null;
  }

  if (line.includes("\t") || line.includes(";") || line.includes("|")) {
    const parts = line.split(/[\t;|]/).map((p) => p.trim()).filter(Boolean);
    return rowFromParts(parts);
  }

  if (/\s{2,}/.test(line)) {
    const parts = line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
    return rowFromParts(parts);
  }

  const priceMatch = line.match(TRAILING_PRICE_RE);
  if (!priceMatch || priceMatch.index == null) return null;

  const price = parsePrice(priceMatch[1]);
  if (price == null) return null;

  const left = line.slice(0, priceMatch.index).trim();
  if (!left) return null;

  const tokens = left.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return { sku: tokens[0], name: tokens[0], category: null, price };
  }

  const sku = tokens[0];
  const name = tokens.slice(1).join(" ");
  return { sku, name: name || sku, category: null, price };
}

export function parsePdfTextToRows(text: string): PriceListRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const rows: PriceListRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = parseLineToRow(line);
    if (!parsed) continue;
    const key = `${parsed.sku}::${parsed.name}::${parsed.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(parsed);
  }

  return rows;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse =
    typeof pdfParseModule.default === "function"
      ? pdfParseModule.default
      : (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);

  const result = await pdfParse(buffer);
  return result.text ?? "";
}

export async function parsePdfToRows(buffer: Buffer): Promise<PriceListRow[]> {
  const text = await extractPdfText(buffer);

  if (!text.trim()) {
    throw new Error(
      "PDF nema čitljiv tekst (možda je skenirana slika). Koristite Excel fajl (.xlsx).",
    );
  }

  return parsePdfTextToRows(text);
}

function headerHasNovaColumn(cells: string[]): boolean {
  return cells.some((cell) => {
    const key = normalizeHeaderKey(cell);
    return key.includes("sifr") && key.includes("ova");
  });
}

/** Skraćeni header (šifra | artikal | tr.pak | p.c | PDV) — u podacima i dalje postoji nova šifra u koloni B. */
function adjustColsForImplicitNova(
  mapped: Partial<Record<ColumnKind, number>>,
  cells: string[],
): Partial<Record<ColumnKind, number>> {
  if (headerHasNovaColumn(cells) || mapped.sku !== 1 || mapped.name !== 2) {
    return mapped;
  }

  const price = mapped.price === 4 ? 5 : (mapped.price ?? 5);
  const pdv = mapped.pdv === 5 ? 6 : (mapped.pdv ?? price + 1);

  return {
    ...mapped,
    novaSifra: 2,
    name: 3,
    price,
    pdv,
  };
}

function colsFromHeader(cells: string[]): Partial<Record<ColumnKind, number>> | null {
  const nonEmpty = cells.filter((c) => c != null && c.trim() !== "");
  if (!isHeaderRowCells(nonEmpty)) return null;
  const mapped = adjustColsForImplicitNova(buildHeaderMap(cells), nonEmpty);
  if (!mapped.name || !mapped.price) return null;

  const pdv =
    mapped.pdv ??
    (mapped.price === 5 ? 6 : mapped.price === 6 ? 7 : mapped.price + 1);

  return {
    sku: mapped.sku ?? 1,
    novaSifra: mapped.novaSifra,
    name: mapped.name,
    category: mapped.category,
    price: mapped.price,
    pdv,
  };
}

function detectLayoutHeuristic(sheet: ExcelJS.Worksheet): Partial<Record<ColumnKind, number>> {
  let compact = 0;
  let wide = 0;
  const limit = Math.min(sheet.rowCount, 250);

  for (let rowNum = 1; rowNum <= limit; rowNum++) {
    const row = sheet.getRow(rowNum);
    const nova = getCell(row, 2);
    if (!/^\d{4,7}$/.test(nova.trim())) continue;

    const c5 = getCell(row, 5);
    const c6 = getCell(row, 6);
    const c7 = getCell(row, 7);

    if (isLikelyPriceRaw(c5) && isPdvColumnRaw(c6)) compact++;
    if (isLikelyPriceRaw(c6) && isPdvColumnRaw(c7)) wide++;
  }

  if (compact > wide) return { ...HORECA_COMPACT_COLS };
  if (wide > compact) return { ...HORECA_WIDE_COLS };
  return { ...HORECA_COMPACT_COLS };
}

function findSheetColumns(sheet: ExcelJS.Worksheet): Partial<Record<ColumnKind, number>> {
  const headerScanLimit = Math.min(sheet.rowCount, 30);

  for (let rowNum = 1; rowNum <= headerScanLimit; rowNum++) {
    const cells = readRowCells(sheet.getRow(rowNum), 12);
    const fromHeader = colsFromHeader(cells);
    if (fromHeader) return fromHeader;
  }
  return detectLayoutHeuristic(sheet);
}

function sheetLooksLikeHoreca(sheet: ExcelJS.Worksheet): boolean {
  const limit = Math.min(sheet.rowCount, 40);
  for (let rowNum = 1; rowNum <= limit; rowNum++) {
    const cells = readRowCells(sheet.getRow(rowNum), 12).filter(Boolean);
    if (isPureColumnHeaderRow(cells)) return true;
    const lower = cells.join(" ").toLowerCase();
    if (lower.includes("horeca") && lower.includes("cenovnik")) return true;
    if (
      cells.some((c) => /šifra|sifra/i.test(c)) &&
      cells.some((c) => /artikal/i.test(c)) &&
      cells.some((c) => /pdv/i.test(c))
    ) {
      return true;
    }
  }
  return false;
}

function pickProductName(
  value: string,
  sku: string,
  novaSifra: string,
): string {
  const v = value.trim();
  if (!v || v === sku || v === novaSifra) return "";
  if (isPackColumn(v)) return "";
  if (/^\d{4,7}$/.test(v)) return "";
  return v;
}

function excludedNameColumns(
  cols: Partial<Record<ColumnKind, number>>,
): Set<number> {
  const skip = new Set<number>();
  for (const col of [
    cols.sku,
    cols.novaSifra,
    cols.category,
    cols.price,
    cols.pdv,
  ]) {
    if (col != null && col >= 1) skip.add(col);
  }
  return skip;
}

function resolveProductName(
  row: ExcelJS.Row,
  cols: Partial<Record<ColumnKind, number>>,
  sku: string,
  novaSifra: string,
): string {
  const nameCol = cols.name ?? 3;
  const skip = excludedNameColumns(cols);
  const candidates = [
    nameCol,
    nameCol === 3 ? 4 : 3,
    3,
    4,
    cols.novaSifra === nameCol ? 3 : nameCol,
  ].filter(
    (c, i, arr) =>
      c >= 2 &&
      c <= 8 &&
      !skip.has(c) &&
      arr.indexOf(c) === i,
  );

  for (const col of candidates) {
    const picked = pickProductName(getCell(row, col), sku, novaSifra);
    if (picked) return picked;
  }

  return "";
}

type SheetParseState = {
  brand: string | null;
};

function applyBrandMarker(state: SheetParseState, label: string | null | undefined): boolean {
  const t = label?.trim();
  if (!t || /^\d+$/.test(t)) return false;
  if (t.length < 2 || t.length >= 80) return false;
  state.brand = t;
  return true;
}

function resolveCategory(
  row: ExcelJS.Row,
  cols: Partial<Record<ColumnKind, number>>,
  state: SheetParseState,
): string | null {
  if (cols.category) {
    const fromCell = getCell(row, cols.category).trim();
    if (fromCell) return fromCell;
  }

  return state.brand?.trim() || null;
}

function resolvePriceAndPdv(
  row: ExcelJS.Row,
  cols: Partial<Record<ColumnKind, number>>,
): { priceRaw: string; pdvRaw: string } {
  const priceCol = cols.price ?? 6;
  const pdvCol = cols.pdv ?? priceCol + 1;
  const candidates = [priceCol, priceCol === 6 ? 5 : 6, 5, 6, 7, 4, 8].filter(
    (c, i, arr) => c >= 4 && c <= 10 && arr.indexOf(c) === i,
  );

  let pdvRaw = getCell(row, pdvCol);

  for (const col of candidates) {
    const raw = getCell(row, col);
    if (!raw.trim() || isPackColumn(raw)) continue;
    if (isPdvColumnRaw(raw)) {
      if (!pdvRaw) pdvRaw = raw;
      continue;
    }
    const n = parsePriceHint(raw);
    if (n == null || isPdvValueAsPrice(n)) continue;
    if (!isLikelyPriceRaw(raw) && !/din|rsd|€|eur/i.test(raw)) continue;
    const pdvGuess = col === 5 ? 6 : col === 6 ? 7 : col + 1;
    return {
      priceRaw: raw,
      pdvRaw: pdvRaw || getCell(row, pdvGuess),
    };
  }

  return { priceRaw: getCell(row, priceCol), pdvRaw: getCell(row, pdvCol) };
}

function parseExcelSheet(
  sheet: ExcelJS.Worksheet,
  initialCols: Partial<Record<ColumnKind, number>>,
  state: SheetParseState,
): { rows: PriceListRow[]; warnings: CatalogImportWarning[] } {
  let cols = { ...initialCols };
  const skuCol = () => cols.sku ?? 1;
  const novaCol = () => cols.novaSifra;

  const rows: PriceListRow[] = [];
  const warnings: CatalogImportWarning[] = [];
  let sheetHeaderMapped = false;
  const isHoreca = sheetLooksLikeHoreca(sheet);
  let horecaLayout: HorecaLayout = cols.name === 4 ? "wide" : "compact";

  for (let rowNum = 1; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const cells = readRowCells(row, 12);
    const cellList = cells.filter((c) => c.trim() !== "");

    if (cellList.length === 0) continue;

    if (isPureColumnHeaderRow(cellList)) {
      if (!sheetHeaderMapped) {
        const headerCols = colsFromHeader(cells);
        if (headerCols) {
          cols = headerCols;
          sheetHeaderMapped = true;
        }
      }
      if (isHoreca) {
        horecaLayout = detectLayoutFromHeader(cellList);
      }
      continue;
    }

    const sifra = getCell(row, skuCol());
    const novaColNum = novaCol();
    const novaSifra = novaColNum ? getCell(row, novaColNum) : "";
    const { priceRaw, pdvRaw } = resolvePriceAndPdv(row, cols);
    const price = parsePrice(priceRaw);
    const pdv_percent = pdvRaw ? parsePdvPercent(pdvRaw) : 20;
    const name = resolveProductName(row, cols, sifra, novaSifra);

    const styledBrand = detectHorecaBrandFromExcelRow(
      row,
      cellList,
      sifra,
      novaSifra,
      name,
      price,
    );
    if (applyBrandMarker(state, styledBrand)) {
      continue;
    }

    if (isHoreca) {
      const kind = classifyHorecaRow(cellList, horecaLayout);
      if (kind === "brand" && applyBrandMarker(state, extractBrandLabel(cellList))) {
        continue;
      }
    }

    const subBrand = isSubBrandRow(sifra, novaSifra, name, priceRaw, state.brand);
    if (applyBrandMarker(state, subBrand)) {
      continue;
    }

    const brandMarker = detectBrandMarkerRow(
      cellList,
      sifra,
      novaSifra,
      name,
      price,
    );
    if (applyBrandMarker(state, brandMarker)) {
      continue;
    }

    const sku = resolveSku(sifra, novaSifra);
    if (!rowLooksLikeProductLine(sifra, novaSifra, name, price)) {
      continue;
    }
    if (!sku || !name || price == null) continue;

    const category = resolveCategory(row, cols, state);
    const product = sanitizePriceListRow({
      sku,
      name,
      category,
      price,
      pdv_percent,
    });
    if (product) {
      warnings.push(...validateCatalogImportRow(product));
      rows.push(product);
    }
  }

  return { rows, warnings };
}

export async function parseExcelBuffer(buffer: Buffer): Promise<PriceListRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const ordered: PriceListRow[] = [];
  const skuToIndex = new Map<string, number>();
  const allWarnings: CatalogImportWarning[] = [];

  const state: SheetParseState = { brand: null };

  for (const sheet of workbook.worksheets) {
    const sheetCols = findSheetColumns(sheet);
    const { rows: sheetRows, warnings } = parseExcelSheet(sheet, sheetCols, state);
    allWarnings.push(...warnings);
    for (const row of sheetRows) {
      const existing = skuToIndex.get(row.sku);
      if (existing !== undefined) {
        ordered[existing] = row;
      } else {
        skuToIndex.set(row.sku, ordered.length);
        ordered.push(row);
      }
    }
  }

  const withOrder = ordered.map((row, index) => ({ ...row, sort_order: index }));
  logCatalogImportDebug("uvoz Excel", withOrder, allWarnings);
  return withOrder;
}

export async function rowsToExcelBuffer(rows: PriceListRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cenovnik");
  sheet.addRow(catalogHeaderRowValues());
  for (const row of rows) {
    sheet.addRow(
      catalogRowToExcelValues({
        sku: row.sku,
        name: row.name,
        category: row.category,
        price: row.price,
        pdv_percent: row.pdv_percent,
      }),
    );
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [
    { width: 14 },
    { width: 42 },
    { width: 18 },
    { width: 16 },
    { width: 10 },
    { width: 12 },
  ];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function convertPdfToExcel(
  buffer: Buffer,
  baseName: string,
): Promise<{
  rows: PriceListRow[];
  excelBuffer: Buffer;
  fileName: string;
}> {
  const rows = await parsePdfToRows(buffer);

  if (!rows.length) {
    throw new Error(
      "Nije pronađena nijedna stavka u PDF-u. Za pouzdan uvoz koristite Excel (.xlsx).",
    );
  }

  const excelBuffer = await rowsToExcelBuffer(rows);
  const safeName = baseName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "cenovnik";
  return {
    rows,
    excelBuffer,
    fileName: `${safeName}.xlsx`,
  };
}

export async function parsePriceListFile(
  buffer: Buffer,
  filename: string,
): Promise<PriceListImportResult> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const rows = await parsePdfToRows(buffer);

    if (!rows.length) {
      throw new Error(
        "PDF nije mogao biti parsiran. Koristite Excel (.xlsx) ili PDF sa selektabilnim tekstom.",
      );
    }

    return { rows, source: "pdf", convertedFromPdf: true };
  }

  if (lower.endsWith(".xlsx")) {
    const rows = await parseExcelBuffer(buffer);
    if (!rows.length) {
      throw new Error("Excel fajl je prazan ili nema prepoznatljivih kolona.");
    }
    return { rows, source: "xlsx", convertedFromPdf: false };
  }

  throw new Error("Podržani formati: .xlsx i .pdf");
}
