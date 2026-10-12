import { jsPDF } from "jspdf";
import autoTable, { type CellDef, type RowInput, type Styles } from "jspdf-autotable";
import type { CatalogColorPalette, QuoteItemWithProduct, QuoteWithItems } from "@/types";
import { fitImageBox, loadImageDimensions } from "@/lib/file-to-base64";
import {
  CATALOG_THEME_DEFAULT,
  catalogThemeToPdfColors,
  normalizeCatalogColors,
} from "@/lib/catalog-theme";
import {
  PDF_FONT,
  PDF_FONT_BOLD,
  registerPdfFonts,
  setPdfFont,
} from "@/lib/pdf-fonts";
import { formatDate } from "@/utils/format";
import { getQuoteLabel } from "@/utils/format-quote-number";
import { normalizeCurrency } from "@/lib/currency";
import {
  linePriceAfterDiscount,
  linePriceWithPdv,
} from "@/utils/quote-calc";
import { sumQuoteGross } from "@/utils/prices";
import { inferMeasureUnit } from "@/utils/measure-unit";

const PAGE_MARGIN = 12;
const CONTENT_WIDTH = 186;

type PdfThemeColors = {
  ink: [number, number, number];
  muted: [number, number, number];
  border: [number, number, number];
  stripe: [number, number, number];
  accent: [number, number, number];
  white: [number, number, number];
  brand: [number, number, number];
  brandText: [number, number, number];
  header: [number, number, number];
  headerText: [number, number, number];
};

function buildPdfTheme(palette?: CatalogColorPalette | null): PdfThemeColors {
  const colors = normalizeCatalogColors(palette, CATALOG_THEME_DEFAULT);
  const themed = catalogThemeToPdfColors(colors);
  return {
    ink: [15, 23, 42],
    muted: [100, 116, 139],
    border: [226, 232, 240],
    stripe: [248, 250, 252],
    white: [255, 255, 255],
    brand: themed.brand,
    brandText: themed.brandText,
    header: themed.header,
    headerText: themed.headerText,
    accent: themed.priceTotal,
  };
}

export interface GenerateQuotePdfOptions {
  /** @deprecated Rabat je uvek uračunat u cene; opcija se ignoriše. */
  showDiscount?: boolean;
  showTotalSummary: boolean;
  /** Kolona M.j. (merna jedinica) u tabeli stavki. */
  showMeasureUnit?: boolean;
  includeLogo?: boolean;
  logoBase64?: string | null;
  companyName?: string;
  companyTaxId?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyBankAccount?: string;
  stampBase64?: string | null;
  /** false = vrati base64 umesto preuzimanja. */
  download?: boolean;
  /** Boje cenovnika (brand headeri / zaglavlje / ukupno). */
  catalogColors?: CatalogColorPalette | null;
}

type JsPdfWithTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function formatPdfMoney(value: number, currency = "RSD"): string {
  const amount = new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${amount} ${normalizeCurrency(currency)}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\s-čćžšđČĆŽŠĐ]/gi, "").replace(/\s+/g, "-");
}

/** npr. Restoran-XYZ-ponuda-PON-2026-0042.pdf */
export function buildQuotePdfFileName(quote: QuoteWithItems): string {
  const customer =
    sanitizeFileName(quote.customer_name.trim()) || "kupac";
  const number = sanitizeFileName(getQuoteLabel(quote));
  return `${customer}-ponuda-${number}.pdf`;
}

const COLUMN_WIDTHS_3 = {
  name: 110,
  net: 38,
  gross: 38,
} as const;

const COLUMN_WIDTHS_4 = {
  name: 98,
  unit: 12,
  net: 38,
  gross: 38,
} as const;

function pdfMeasureUnit(item: QuoteItemWithProduct): string {
  return item.measure_unit?.trim() || inferMeasureUnit(item.name, item.category);
}

function groupQuoteItemsByBrand(
  items: QuoteItemWithProduct[],
): { label: string; items: QuoteItemWithProduct[] }[] {
  const sorted = [...items].sort((a, b) => {
    const order = a.sort_order - b.sort_order;
    if (order !== 0) return order;
    return a.id - b.id;
  });

  const groups: { label: string; items: QuoteItemWithProduct[] }[] = [];

  for (const item of sorted) {
    const label = item.category?.trim() || "Ostalo";
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return groups;
}

function brandHeaderRow(
  label: string,
  withSpacer: boolean,
  colCount: number,
  colors: PdfThemeColors,
): RowInput[] {
  const rows: RowInput[] = [];

  if (withSpacer) {
    rows.push([
      {
        content: "",
        colSpan: colCount,
        styles: {
          fillColor: colors.white,
          lineWidth: 0,
          minCellHeight: 3,
          cellPadding: 0,
        },
      },
    ]);
  }

  rows.push([
    {
      content: label.toUpperCase(),
      colSpan: colCount,
      styles: {
        fillColor: colors.brand,
        textColor: colors.brandText,
        font: PDF_FONT_BOLD,
        fontStyle: "normal",
        fontSize: 6.5,
        halign: "center",
        valign: "middle",
        cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
        minCellHeight: 5.5,
      },
    },
  ]);

  return rows;
}

function buildTableBody(
  items: QuoteItemWithProduct[],
  showMeasureUnit: boolean,
  currency: string,
  colors: PdfThemeColors,
): RowInput[] {
  const colCount = showMeasureUnit ? 4 : 3;
  const groups = groupQuoteItemsByBrand(items);
  const body: RowInput[] = [];
  let productStripe = false;

  groups.forEach((group, groupIndex) => {
    body.push(...brandHeaderRow(group.label, groupIndex > 0, colCount, colors));

    for (const item of group.items) {
      const netWithDiscount =
        linePriceAfterDiscount(item.unit_price, item.discount_percent) *
        (item.qty || 1);
      const grossWithDiscount =
        linePriceWithPdv(
          item.unit_price,
          item.discount_percent,
          item.pdv_percent,
        ) * (item.qty || 1);

      const displayName =
        (item.qty || 1) > 1 ? `${item.name} (${item.qty} kom)` : item.name;

      const fillColor = productStripe ? colors.stripe : colors.white;
      productStripe = !productStripe;

      const row: CellDef[] = [
        {
          content: displayName,
          styles: {
            fillColor,
            font: PDF_FONT_BOLD,
            fontStyle: "normal",
            fontSize: 6.5,
            cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2.5 },
            minCellHeight: 5,
          },
        },
      ];

      if (showMeasureUnit) {
        row.push({
          content: pdfMeasureUnit(item),
          styles: {
            fillColor,
            fontSize: 6,
            halign: "center",
            valign: "middle",
            cellPadding: { top: 1.5, right: 1, bottom: 1.5, left: 1 },
            minCellHeight: 5,
          },
        });
      }

      row.push(
        {
          content: formatPdfMoney(netWithDiscount, currency),
          styles: {
            fillColor,
            font: PDF_FONT_BOLD,
            fontStyle: "normal",
            fontSize: 6,
            halign: "right",
            valign: "middle",
            cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 1 },
            minCellHeight: 5,
          },
        },
        {
          content: formatPdfMoney(grossWithDiscount, currency),
          styles: {
            fillColor,
            fontSize: 6,
            halign: "right",
            valign: "middle",
            cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 1 },
            minCellHeight: 5,
          },
        },
      );

      body.push(row);
    }
  });

  return body;
}

async function yieldToMain(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function drawHeader(
  doc: jsPDF,
  quote: QuoteWithItems,
  options: GenerateQuotePdfOptions,
  colors: PdfThemeColors,
): Promise<number> {
  const companyName =
    options.companyName?.trim() ||
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    "PonudeApp";

  let y = PAGE_MARGIN;

  if (options.includeLogo && options.logoBase64) {
    try {
      const { width, height } = await loadImageDimensions(options.logoBase64);
      const box = fitImageBox(width, height, 48, 22);
      const format = options.logoBase64.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(
        options.logoBase64,
        format,
        PAGE_MARGIN,
        y,
        box.width,
        box.height,
        undefined,
        "FAST",
      );
      y += box.height + 6;
    } catch {
      /* preskoči */
    }
  }

  const details = [
    options.companyTaxId?.trim() ? `PIB: ${options.companyTaxId.trim()}` : null,
    options.companyAddress?.trim() || null,
    options.companyPhone?.trim() || null,
    options.companyBankAccount?.trim()
      ? `Žiro: ${options.companyBankAccount.trim()}`
      : null,
  ].filter((line): line is string => Boolean(line));

  if (details.length) {
    setPdfFont(doc, "normal", 8);
    doc.setTextColor(...colors.muted);
    for (const line of details) {
      const wrapped = doc.splitTextToSize(line, 90) as string[];
      doc.text(wrapped, PAGE_MARGIN, y);
      y += wrapped.length * 3.6;
    }
    y += 2;
  }

  if (options.stampBase64) {
    try {
      const { width, height } = await loadImageDimensions(options.stampBase64);
      const box = fitImageBox(width, height, 22, 22);
      const format = options.stampBase64.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(
        options.stampBase64,
        format,
        PAGE_MARGIN,
        y,
        box.width,
        box.height,
        undefined,
        "FAST",
      );
      y += box.height + 4;
    } catch {
      /* preskoči */
    }
  }

  const headerTop = PAGE_MARGIN;
  const metaX = PAGE_MARGIN + CONTENT_WIDTH;

  setPdfFont(doc, "normal", 10);
  doc.setTextColor(...colors.muted);
  doc.text(companyName, metaX, headerTop + 4, { align: "right" });

  setPdfFont(doc, "bold", 24);
  doc.setTextColor(...colors.ink);
  doc.text("PONUDA", metaX, headerTop + 15, { align: "right" });

  setPdfFont(doc, "normal", 10);
  doc.setTextColor(...colors.muted);
  doc.text(`Datum: ${formatDate(quote.created_at)}`, metaX, headerTop + 23, {
    align: "right",
  });
  doc.text(`Broj: ${getQuoteLabel(quote)}`, metaX, headerTop + 29, {
    align: "right",
  });

  if (quote.valid_until) {
    doc.text(
      `Važi do: ${formatDate(quote.valid_until)}`,
      metaX,
      headerTop + 35,
      { align: "right" },
    );
  }

  const blockY = Math.max(y, headerTop + 36);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN, blockY, PAGE_MARGIN + CONTENT_WIDTH, blockY);

  setPdfFont(doc, "bold", 11);
  doc.setTextColor(...colors.ink);
  doc.text("Kupac", PAGE_MARGIN, blockY + 9);

  setPdfFont(doc, "normal", 11);
  const customerLines = doc.splitTextToSize(
    quote.customer_name,
    CONTENT_WIDTH * 0.55,
  ) as string[];
  doc.text(customerLines, PAGE_MARGIN, blockY + 16);

  return blockY + 16 + customerLines.length * 5 + 6;
}

function drawTotalsBlock(
  doc: jsPDF,
  startY: number,
  finalTotal: number,
  currency: string,
  colors: PdfThemeColors,
) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const boxWidth = 72;
  const boxHeight = 22;
  const boxX = PAGE_MARGIN + CONTENT_WIDTH - boxWidth;

  let y = startY + 8;
  if (y + boxHeight > pageHeight - 14) {
    doc.addPage();
    y = PAGE_MARGIN + 8;
  }

  doc.setFillColor(...colors.stripe);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxWidth, boxHeight, 2, 2, "FD");

  const labelX = boxX + 5;
  const valueX = boxX + boxWidth - 5;

  setPdfFont(doc, "bold", 9);
  doc.setTextColor(...colors.ink);
  doc.text("UKUPNO SA PDV", labelX, y + 10);

  setPdfFont(doc, "bold", 12);
  doc.setTextColor(...colors.accent);
  doc.text(
    formatPdfMoney(finalTotal, currency),
    valueX,
    y + 10,
    { align: "right" },
  );
}

export async function generateQuotePDF(
  quote: QuoteWithItems,
  options: GenerateQuotePdfOptions,
): Promise<string | void> {
  if (!quote.items.length) {
    throw new Error("Ponuda nema stavki za export");
  }

  await yieldToMain();

  const colors = buildPdfTheme(options.catalogColors);
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsPdfWithTable;
  await registerPdfFonts(doc);

  const tableStartY = await drawHeader(doc, quote, options, colors);
  const finalTotal = sumQuoteGross(quote.items);
  const showMeasureUnit = options.showMeasureUnit === true;

  const head = showMeasureUnit
    ? ["Naziv artikla", "M.j.", "Bez PDV", "Sa PDV"]
    : ["Naziv artikla", "Bez PDV", "Sa PDV"];

  const columnStyles: Record<string, Partial<Styles>> = showMeasureUnit
    ? {
        0: { cellWidth: COLUMN_WIDTHS_4.name, halign: "left" },
        1: { cellWidth: COLUMN_WIDTHS_4.unit, halign: "center" },
        2: { cellWidth: COLUMN_WIDTHS_4.net, halign: "right" },
        3: { cellWidth: COLUMN_WIDTHS_4.gross, halign: "right" },
      }
    : {
        0: { cellWidth: COLUMN_WIDTHS_3.name, halign: "left" },
        1: { cellWidth: COLUMN_WIDTHS_3.net, halign: "right" },
        2: { cellWidth: COLUMN_WIDTHS_3.gross, halign: "right" },
      };

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 14 },
    tableWidth: CONTENT_WIDTH,
    head: [head],
    body: buildTableBody(quote.items, showMeasureUnit, quote.currency, colors),
    theme: "plain",
    styles: {
      font: PDF_FONT,
      fontSize: 6,
      overflow: "linebreak",
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      lineColor: colors.border,
      lineWidth: 0.1,
      textColor: colors.ink,
      valign: "middle",
      minCellHeight: 5,
    },
    headStyles: {
      font: PDF_FONT_BOLD,
      fontStyle: "normal",
      fillColor: colors.header,
      textColor: colors.headerText,
      fontSize: 6.5,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      valign: "middle",
      halign: "center",
      minCellHeight: 6,
    },
    columnStyles,
    didDrawPage: (data) => {
      setPdfFont(doc, "normal", 7);
      doc.setTextColor(...colors.muted);
      const footerY = doc.internal.pageSize.getHeight() - 7;
      if (quote.note?.trim() && data.pageNumber === doc.getNumberOfPages()) {
        doc.text(quote.note.trim(), PAGE_MARGIN, footerY - 4, {
          maxWidth: CONTENT_WIDTH * 0.65,
        });
      }
      doc.text(
        `Strana ${data.pageNumber} / ${doc.getNumberOfPages()}`,
        PAGE_MARGIN + CONTENT_WIDTH,
        footerY,
        { align: "right" },
      );
    },
  });

  if (options.showTotalSummary) {
    const finalY = doc.lastAutoTable?.finalY ?? tableStartY + 40;
    drawTotalsBlock(doc, finalY, finalTotal, quote.currency, colors);
  }

  await yieldToMain();

  if (options.download === false) {
    const uri = doc.output("datauristring");
    const comma = uri.indexOf(",");
    return comma >= 0 ? uri.slice(comma + 1) : uri;
  }

  doc.save(buildQuotePdfFileName(quote));
}
