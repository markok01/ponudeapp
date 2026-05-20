import ExcelJS from "exceljs";
import type { HorecaExcelRow, HorecaLayout } from "@/utils/horeca-excel-styles";
import {
  cellsForExport,
  classifyHorecaRow,
  cleanCell,
  detectLayoutFromHeader,
  normalizeBrandRowCells,
  extractBrandLabel,
  normalizeRowCells,
} from "@/utils/horeca-row-classify";

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
    return String((v as { result?: unknown }).result ?? "").trim();
  }
  return "";
}

function readRowCells(row: ExcelJS.Row, maxCol = 10): string[] {
  const cells: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    cells.push(cellValue(row.getCell(c)));
  }
  while (cells.length > 0 && !cells[cells.length - 1]) cells.pop();
  return cells;
}

function inferLayoutFromSheet(sheet: ExcelJS.Worksheet): HorecaLayout {
  for (let r = 1; r <= Math.min(sheet.rowCount, 50); r++) {
    const cells = readRowCells(sheet.getRow(r));
    if (cells.some((c) => /artikal|artiakal/i.test(c))) {
      return detectLayoutFromHeader(cells);
    }
  }
  return sheet.name.match(/table\s*3/i) ? "compact" : "wide";
}

export function parseHorecaExcelSheet(
  sheet: ExcelJS.Worksheet,
  defaultLayout?: HorecaLayout,
): HorecaExcelRow[] {
  const layout = defaultLayout ?? inferLayoutFromSheet(sheet);
  const colCount = layout === "wide" ? 7 : 6;
  const rows: HorecaExcelRow[] = [];

  for (let rowNum = 1; rowNum <= sheet.rowCount; rowNum++) {
    const raw = readRowCells(sheet.getRow(rowNum), 10);
    if (!raw.some(Boolean)) continue;

    const cells = normalizeRowCells(raw, colCount);
    const kind = classifyHorecaRow(cells, layout);
    let exportCells = cellsForExport(kind, cells, layout);
    if (kind === "brand") {
      exportCells = normalizeBrandRowCells(extractBrandLabel(cells), layout);
    }

    rows.push({ kind, layout, cells: exportCells });
  }

  return rows;
}

export async function parseHorecaExcelBuffer(buffer: Buffer): Promise<
  { name: string; rows: HorecaExcelRow[]; layout: HorecaLayout }[]
> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  return workbook.worksheets.map((sheet) => {
    const layout = inferLayoutFromSheet(sheet);
    return {
      name: sheet.name,
      rows: parseHorecaExcelSheet(sheet, layout),
      layout,
    };
  });
}
