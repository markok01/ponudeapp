import ExcelJS from "exceljs";
import type { Product } from "@/types";
import {
  catalogHeaderRowValues,
  catalogRowToExcelValues,
} from "@/utils/catalog-excel";
import { groupProductsByCategory } from "@/utils/catalog-display";

export async function buildCatalogExcelBuffer(products: Product[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cenovnik");

  const groups = groupProductsByCategory(products);

  const headerRow = sheet.addRow(catalogHeaderRowValues());
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD4CCE8" },
  };

  for (const group of groups) {
    const brandRow = sheet.addRow([group.groupLabel]);
    const brandRowNumber = brandRow.number;
    sheet.mergeCells(brandRowNumber, 1, brandRowNumber, catalogHeaderRowValues().length);
    brandRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    brandRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFA89BC9" },
    };

    for (const product of group.products) {
      const dataRow = sheet.addRow(
        catalogRowToExcelValues({
          sku: product.sku,
          name: product.name,
          category: product.category,
          price: product.price,
          pdv_percent: product.pdv_percent,
          measure_unit: product.measure_unit,
        }),
      );
      dataRow.getCell(4).numFmt = '#,##0.00 "RSD"';
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
