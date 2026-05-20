import ExcelJS from "exceljs";
import type { Product } from "@/types";
import { groupProductsByCategory } from "@/utils/catalog-display";

export async function buildCatalogExcelBuffer(products: Product[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cenovnik");

  const groups = groupProductsByCategory(products);

  sheet.getRow(1).values = ["Šifra", "Artikal", "Brend", "Cena bez PDV", "PDV %", "Jedinica"];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD4CCE8" },
  };

  let rowIndex = 2;
  for (const group of groups) {
    const brandRow = sheet.getRow(rowIndex);
    brandRow.getCell(1).value = group.groupLabel;
    sheet.mergeCells(rowIndex, 1, rowIndex, 6);
    brandRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    brandRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFA89BC9" },
    };
    rowIndex++;

    for (const product of group.products) {
      const row = sheet.getRow(rowIndex);
      row.getCell(1).value = product.sku;
      row.getCell(2).value = product.name;
      row.getCell(3).value = product.category ?? "";
      row.getCell(4).value = product.price;
      row.getCell(5).value = product.pdv_percent;
      row.getCell(6).value = product.measure_unit ?? "kom";
      row.getCell(4).numFmt = '#,##0.00 "RSD"';
      rowIndex++;
    }
  }

  sheet.columns = [
    { width: 14 },
    { width: 42 },
    { width: 18 },
    { width: 16 },
    { width: 10 },
    { width: 12 },
  ];

  return workbook.xlsx.writeBuffer();
}

export async function downloadCatalogExcel(products: Product[], filename = "cenovnik.xlsx") {
  const buffer = await buildCatalogExcelBuffer(products);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
