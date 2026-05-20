import ExcelJS from "exceljs";
import { readFileSync } from "fs";

const buf = readFileSync("HoReCa cenovnik -primena 01.06.2026.xlsx");
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);

function cellVal(c) {
  const v = c.value;
  if (v == null) return "";
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  if (typeof v === "object" && "richText" in v)
    return v.richText.map((t) => t.text).join("");
  return String(v).trim();
}

for (const sheet of wb.worksheets) {
  console.log(`\n=== ${sheet.name} (${sheet.rowCount} rows) ===`);
  for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    const parts = [];
    for (let c = 1; c <= 10; c++) {
      parts.push(cellVal(row.getCell(c)) || "·");
    }
    console.log(`R${r}: ${parts.join(" | ")}`);
  }
}
