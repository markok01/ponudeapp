import ExcelJS from "exceljs";
import type { QuoteWithItems } from "@/types";
import { linePriceAfterDiscount, linePriceWithPdv } from "@/utils/quote-calc";
import { formatDate } from "@/utils/format";
import { getQuoteLabel } from "@/utils/format-quote-number";

export async function exportQuoteExcel(quote: QuoteWithItems) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ponuda");

  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = "Ponuda";
  sheet.getCell("A1").font = { size: 16, bold: true };

  sheet.getCell("A3").value = "Kupac:";
  sheet.getCell("B3").value = quote.customer_name;
  sheet.getCell("A4").value = "Datum:";
  sheet.getCell("B4").value = new Date(quote.created_at);
  sheet.getCell("A5").value = "Broj:";
  sheet.getCell("B5").value = getQuoteLabel(quote);

  let metaRow = 6;
  if (quote.valid_until) {
    sheet.getCell(`A${metaRow}`).value = "Važi do:";
    sheet.getCell(`B${metaRow}`).value = formatDate(quote.valid_until);
    metaRow += 1;
  }
  if (quote.note) {
    sheet.getCell(`A${metaRow}`).value = "Napomena:";
    sheet.getCell(`B${metaRow}`).value = quote.note;
    metaRow += 1;
  }

  const headerRowNum = metaRow + 1;
  const headerRow = sheet.getRow(headerRowNum);
  [
    "Šifra",
    "Proizvod",
    "Količina",
    "Cena / jm",
    "Rabat %",
    "Bez PDV (linija)",
    "Sa PDV (linija)",
  ].forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" },
    };
  });

  quote.items.forEach((item, index) => {
    const row = sheet.getRow(headerRowNum + 1 + index);
    const qty = item.qty || 1;
    row.getCell(1).value = item.sku;
    row.getCell(2).value = item.name;
    row.getCell(3).value = qty;
    row.getCell(4).value = item.unit_price;
    row.getCell(5).value = item.discount_percent;
    row.getCell(6).value =
      linePriceAfterDiscount(item.unit_price, item.discount_percent) * qty;
    row.getCell(7).value =
      linePriceWithPdv(
        item.unit_price,
        item.discount_percent,
        item.pdv_percent,
      ) * qty;
    row.getCell(4).numFmt = '#,##0.00 "RSD"';
    row.getCell(6).numFmt = '#,##0.00 "RSD"';
    row.getCell(7).numFmt = '#,##0.00 "RSD"';
  });

  const totalRow = sheet.getRow(headerRowNum + 1 + quote.items.length);
  totalRow.getCell(6).value = "UKUPNO";
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(7).value = quote.total;
  totalRow.getCell(7).numFmt = '#,##0.00 "RSD"';
  totalRow.getCell(7).font = { bold: true };

  sheet.columns = [
    { width: 14 },
    { width: 36 },
    { width: 10 },
    { width: 14 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${getQuoteLabel(quote)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
