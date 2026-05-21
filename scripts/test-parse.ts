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
  const paths = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["HoReCa cenovnik -primena 01.06.2026.xlsx"];

  for (const path of paths) {
    const buf = Buffer.from(readFileSync(path));
    const rows = await parseExcelBuffer(buf);
    console.log(path, "parsed", rows.length);
  }
}

main().catch(console.error);
