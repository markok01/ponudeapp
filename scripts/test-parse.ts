import { readFileSync } from "fs";
import ExcelJS from "exceljs";
import { isBrandRow } from "../utils/price-list-columns";
import { parseExcelBuffer } from "../utils/price-list-parse";

function cellValue(cell: ExcelJS.Cell): string {
  const text = cell.text?.trim();
  if (text) return text;
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("").trim();
  }
  return String(v ?? "").trim();
}

async function main() {
  const buf = Buffer.from(
    readFileSync("HoReCa cenovnik -primena 01.06.2026.xlsx"),
  );
  const rows = await parseExcelBuffer(buf);

  console.log("total", rows.length);
  console.log("10001", rows.find((r) => r.sku === "10001"));
  console.log("name===sku", rows.filter((r) => r.name === r.sku).length);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.getWorksheet("Table 3");
  for (const r of [210, 229, 234]) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col <= 10) cells[col - 1] = cellValue(cell);
    });
    const list = cells.filter((c) => c) as string[];
    console.log("R" + r, list, "brand?", isBrandRow(list));
  }
}

main().catch(console.error);
