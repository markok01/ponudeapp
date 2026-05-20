import ExcelJS from "exceljs";
import type { PriceListImportResult, PriceListRow } from "@/types/price-list";
import {
  buildHeaderMap,
  HORECA_COMPACT_COLS,
  HORECA_WIDE_COLS,
  isBrandRow,
  isHeaderRowCells,
  isLikelyPriceRaw,
  isPackColumn,
  isPdvColumnRaw,
  isSubBrandRow,
  normalizeHeaderKey,
  parsePdvPercent,
  parsePriceHint,
  resolveSku,
  sanitizePriceListRow,
  type ColumnKind,
} from "@/utils/price-list-columns";

export function parsePrice(value: string): number | null {
  return parsePriceHint(value);
}

function cellValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v != null && typeof v === "object" && "richText" in v) {
    const rich = v as { richText: { text: string }[] };
    const fromRich = rich.richText.map((t) => t.text).join("").trim();
    if (fromRich) return fromRich;
  }

  const text = cell.text?.trim();
  if (text && text !== "[object Object]") return text;

  if (v == null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && "result" in v) {
    const r = (v as { result?: unknown }).result;
    if (r != null) return String(r).trim();
  }
  if (typeof v === "object" && "text" in v) {
    return String((v as { text: string }).text ?? "").trim();
  }
  return "";
}

function getCell(row: ExcelJS.Row, col?: number): string {
  if (!col) return "";
  return cellValue(row.getCell(col));
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

function colsFromHeader(cells: string[]): Partial<Record<ColumnKind, number>> | null {
  if (!isHeaderRowCells(cells)) return null;
  const mapped = buildHeaderMap(cells);
  if (!mapped.name || !mapped.price) return null;

  const pdv =
    mapped.pdv ??
    (mapped.price === 5 ? 6 : mapped.price === 6 ? 7 : mapped.price + 1);

  return {
    sku: mapped.sku ?? 1,
    novaSifra: mapped.novaSifra ?? 2,
    name: mapped.name,
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
  for (let rowNum = 1; rowNum <= sheet.rowCount; rowNum++) {
    const cells: string[] = [];
    sheet.getRow(rowNum).eachCell({ includeEmpty: false }, (cell) => {
      cells.push(cellValue(cell));
    });
    const fromHeader = colsFromHeader(cells);
    if (fromHeader) return fromHeader;
  }
  return detectLayoutHeuristic(sheet);
}

function resolveProductName(
  row: ExcelJS.Row,
  cols: Partial<Record<ColumnKind, number>>,
  sku: string,
  novaSifra: string,
): string {
  const nameCol = cols.name ?? 3;
  const primary = getCell(row, nameCol);
  const alt = getCell(row, nameCol === 3 ? 4 : 3);

  const pick = (value: string) => {
    const v = value.trim();
    if (!v || v === sku || v === novaSifra) return "";
    if (isPackColumn(v)) return "";
    if (/^\d{4,7}$/.test(v)) return "";
    return v;
  };

  return pick(primary) || pick(alt);
}

function resolvePriceAndPdv(
  row: ExcelJS.Row,
  cols: Partial<Record<ColumnKind, number>>,
): { priceRaw: string; pdvRaw: string } {
  const priceCol = cols.price ?? 6;
  const pdvCol = cols.pdv ?? priceCol + 1;
  const fallbacks = [priceCol, priceCol === 6 ? 5 : 6, 5, 6, 7].filter(
    (c, i, arr) => arr.indexOf(c) === i,
  );

  for (const col of fallbacks) {
    const raw = getCell(row, col);
    if (!isLikelyPriceRaw(raw)) continue;
    const pdvGuess = col === 5 ? 6 : col === 6 ? 7 : col + 1;
    return {
      priceRaw: raw,
      pdvRaw: getCell(row, pdvCol) || getCell(row, pdvGuess),
    };
  }

  return { priceRaw: getCell(row, priceCol), pdvRaw: getCell(row, pdvCol) };
}

function parseExcelSheet(
  sheet: ExcelJS.Worksheet,
  initialCols: Partial<Record<ColumnKind, number>>,
  state: { brand: string | null; subBrand: string | null },
): PriceListRow[] {
  let cols = { ...initialCols };
  const skuCol = () => cols.sku ?? 1;
  const novaCol = () => cols.novaSifra ?? 2;

  const rows: PriceListRow[] = [];

  for (let rowNum = 1; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col <= 10) cells[col - 1] = cellValue(cell);
    });
    const cellList = cells.filter((c) => c != null && c !== "") as string[];

    if (cellList.length === 0) continue;

    const headerCols = colsFromHeader(cellList);
    if (headerCols) {
      cols = headerCols;
      continue;
    }

    const sifra = getCell(row, skuCol());
    const novaSifra = getCell(row, novaCol());
    const { priceRaw, pdvRaw } = resolvePriceAndPdv(row, cols);
    const price = parsePrice(priceRaw);
    const pdv_percent = pdvRaw ? parsePdvPercent(pdvRaw) : 20;
    const name = resolveProductName(row, cols, sifra, novaSifra);

    const subBrand = isSubBrandRow(sifra, novaSifra, name, priceRaw);
    if (subBrand) {
      state.subBrand = subBrand;
      continue;
    }

    const brand = isBrandRow(cellList);
    if (brand) {
      state.brand = brand;
      state.subBrand = null;
      continue;
    }

    const sku = resolveSku(sifra, novaSifra);
    if (!sku || !name || price == null) continue;

    const categoryParts = [state.brand, state.subBrand].filter(Boolean);
    const product = sanitizePriceListRow({
      sku,
      name,
      category: categoryParts.length ? categoryParts.join(" / ") : null,
      price,
      pdv_percent,
    });
    if (product) rows.push(product);
  }

  return rows;
}

export async function parseExcelBuffer(buffer: Buffer): Promise<PriceListRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const state = { brand: null as string | null, subBrand: null as string | null };
  const ordered: PriceListRow[] = [];
  const skuToIndex = new Map<string, number>();

  for (const sheet of workbook.worksheets) {
    const sheetCols = findSheetColumns(sheet);
    const sheetRows = parseExcelSheet(sheet, sheetCols, state);
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

  return ordered.map((row, index) => ({ ...row, sort_order: index }));
}

export async function rowsToExcelBuffer(rows: PriceListRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cenovnik");
  sheet.addRow(["sku", "name", "category", "price"]);
  for (const row of rows) {
    sheet.addRow([row.sku, row.name, row.category ?? "", row.price]);
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [
    { width: 18 },
    { width: 48 },
    { width: 22 },
    { width: 14 },
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
