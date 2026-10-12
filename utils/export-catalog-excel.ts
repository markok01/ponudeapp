import ExcelJS from "exceljs";
import type { CatalogColorPalette, Product } from "@/types";
import { DEFAULT_CURRENCY, excelCurrencyNumFmt, type Currency } from "@/lib/currency";
import {
  CATALOG_THEME_DEFAULT,
  hexToArgb,
  normalizeCatalogColors,
} from "@/lib/catalog-theme";
import {
  catalogHeaderRowValues,
  catalogRowToExcelValues,
} from "@/utils/catalog-excel";
import { groupProductsByCategory } from "@/utils/catalog-display";

export async function buildCatalogExcelBuffer(
  products: Product[],
  currency: Currency = DEFAULT_CURRENCY,
  catalogColors?: CatalogColorPalette | null,
): Promise<ArrayBuffer> {
  const theme = normalizeCatalogColors(catalogColors, CATALOG_THEME_DEFAULT);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cenovnik");
  const moneyFmt = excelCurrencyNumFmt(currency);

  const groups = groupProductsByCategory(products);

  const headerRow = sheet.addRow(catalogHeaderRowValues());
  headerRow.font = {
    bold: true,
    color: { argb: hexToArgb(theme.headerText) },
  };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: hexToArgb(theme.headerBg) },
  };

  for (const group of groups) {
    const brandRow = sheet.addRow([group.groupLabel]);
    const brandRowNumber = brandRow.number;
    sheet.mergeCells(brandRowNumber, 1, brandRowNumber, catalogHeaderRowValues().length);
    brandRow.font = {
      bold: true,
      color: { argb: hexToArgb(theme.brandText) },
    };
    brandRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hexToArgb(theme.brandBg) },
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
      dataRow.getCell(4).numFmt = moneyFmt;
      dataRow.getCell(4).font = { color: { argb: hexToArgb(theme.price) } };
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

export async function downloadCatalogExcel(
  products: Product[],
  filename = "cenovnik.xlsx",
  currency: Currency = DEFAULT_CURRENCY,
  catalogColors?: CatalogColorPalette | null,
) {
  const buffer = await buildCatalogExcelBuffer(products, currency, catalogColors);
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
