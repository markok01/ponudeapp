import ExcelJS from "exceljs";
import {
  columnCount,
  HORECA_BRAND_FILL,
  HORECA_COMPACT_HEADERS,
  HORECA_HEADER_FILL,
  HORECA_WIDE_HEADERS,
  type HorecaExcelRow,
  type HorecaLayout,
  type HorecaRowKind,
} from "@/utils/horeca-excel-styles";
import { cellsForExport, extractBrandLabel } from "@/utils/horeca-row-classify";
import { formatCellValue } from "@/utils/horeca-cell-format";

const THIN_BORDER = {
  top: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
  left: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
  bottom: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
  right: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
};

function applyBrandRow(ws: ExcelJS.Worksheet, row: ExcelJS.Row, label: string, colCount: number) {
  row.getCell(1).value = label;
  try {
    ws.mergeCells(row.number, 1, row.number, colCount);
  } catch {
    /* already merged */
  }
  const master = row.getCell(1);
  master.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HORECA_BRAND_FILL },
  };
  master.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  master.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  master.border = THIN_BORDER;
  row.height = 18;
}

function applyHeaderRow(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HORECA_HEADER_FILL },
    };
    cell.font = { bold: true, size: 10, color: { argb: "FF000000" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  }
}

function applyProductRow(row: ExcelJS.Row, colCount: number, layout: HorecaLayout) {
  const priceCol = layout === "wide" ? 6 : 5;
  const pdvCol = layout === "wide" ? 7 : 6;

  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { size: 10, bold: false };
    cell.border = THIN_BORDER;
    cell.alignment =
      c === priceCol || c === pdvCol
        ? { horizontal: "right", vertical: "top", wrapText: true }
        : { vertical: "top", wrapText: true };
  }
}

function applyTitleRow(row: ExcelJS.Row, colCount: number) {
  const cell = row.getCell(1);
  cell.font = { bold: true, size: 12 };
  try {
    row.worksheet.mergeCells(row.number, 1, row.number, colCount);
  } catch {
    /* ignore */
  }
}

function writeCells(
  row: ExcelJS.Row,
  cells: string[],
  colCount: number,
  layout: HorecaLayout,
) {
  for (let i = 0; i < colCount; i++) {
    const val = cells[i] ?? "";
    const cell = row.getCell(i + 1);
    formatCellValue(cell, val, i + 1, layout);
  }
}

function applyRowStyle(
  ws: ExcelJS.Worksheet,
  row: ExcelJS.Row,
  kind: HorecaRowKind,
  cells: string[],
  colCount: number,
  layout: HorecaLayout,
) {
  if (kind === "brand") {
    applyBrandRow(ws, row, extractBrandLabel(cells), colCount);
    return;
  }
  if (kind === "header") {
    applyHeaderRow(row, colCount);
    return;
  }
  if (kind === "product") {
    applyProductRow(row, colCount, layout);
    return;
  }
  if (kind === "title") {
    applyTitleRow(row, colCount);
    return;
  }
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = THIN_BORDER;
  }
}

function mergeHorecaSheets(
  sheets: { name: string; rows: HorecaExcelRow[]; layout: HorecaLayout }[],
): { name: string; rows: HorecaExcelRow[]; layout: HorecaLayout }[] {
  if (sheets.length <= 1) {
    if (sheets[0]) return [{ ...sheets[0], name: sheets[0].name || "Cenovnik" }];
    return sheets;
  }
  const layout = sheets[0]?.layout ?? "compact";
  const rows: HorecaExcelRow[] = [];
  for (let i = 0; i < sheets.length; i++) {
    if (i > 0) rows.push({ kind: "raw", cells: [], layout });
    rows.push(...sheets[i].rows);
  }
  return [{ name: "Cenovnik", rows, layout }];
}

export async function exportHorecaWorkbook(
  sheets: { name: string; rows: HorecaExcelRow[]; layout: HorecaLayout }[],
): Promise<Buffer> {
  const mergedSheets = mergeHorecaSheets(sheets);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PonudeApp";
  workbook.created = new Date();

  for (const { name, rows, layout } of mergedSheets) {
    const colCount = columnCount(layout);
    const ws = workbook.addWorksheet(name.slice(0, 31));

    let excelRowNum = 0;
    for (const item of rows) {
      if (item.kind === "raw" && !item.cells.some(Boolean)) continue;

      excelRowNum++;
      const row = ws.getRow(excelRowNum);
      const exportCells = cellsForExport(item.kind, item.cells, item.layout);
      writeCells(row, exportCells, colCount, item.layout);
      applyRowStyle(ws, row, item.kind, exportCells, colCount, item.layout);
    }

    if (rows.length === 0) {
      const headers = layout === "wide" ? HORECA_WIDE_HEADERS : HORECA_COMPACT_HEADERS;
      const headerRow = ws.addRow([...headers]);
      writeCells(headerRow, [...headers], colCount, layout);
      applyHeaderRow(headerRow, colCount);
    }

    ws.columns = [
      { width: 10 },
      { width: 12 },
      { width: 42 },
      { width: 42 },
      { width: 14 },
      { width: 18 },
      { width: 8 },
    ].slice(0, colCount);
  }

  if (workbook.worksheets.length === 0) {
    const ws = workbook.addWorksheet("Cenovnik");
    const headerRow = ws.addRow([...HORECA_WIDE_HEADERS]);
    applyHeaderRow(headerRow, 7);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Klonira postojeći HoReCa .xlsx sa svim stilovima (100% identičan). */
export async function cloneHorecaWorkbook(buffer: Buffer): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
