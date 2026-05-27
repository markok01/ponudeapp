import { jsPDF } from "jspdf";
import autoTable, { type CellDef, type RowInput } from "jspdf-autotable";
import type { QuoteItemWithProduct, QuoteWithItems } from "@/types";
import { fitImageBox, loadImageDimensions } from "@/lib/file-to-base64";
import {
  PDF_FONT,
  PDF_FONT_BOLD,
  registerPdfFonts,
  setPdfFont,
} from "@/lib/pdf-fonts";
import { formatDate } from "@/utils/format";
import { getQuoteLabel } from "@/utils/format-quote-number";
import {
  linePriceAfterDiscount,
  linePriceWithPdv,
} from "@/utils/quote-calc";
import { sumQuoteGross } from "@/utils/prices";

const PAGE_MARGIN = 12;
const CONTENT_WIDTH = 186;

const COLORS = {
  ink: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  stripe: [248, 250, 252] as [number, number, number],
  accent: [37, 99, 235] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  brand: [176, 159, 198] as [number, number, number],
};

export interface GenerateQuotePdfOptions {
  /** @deprecated Rabat je uvek uračunat u cene; opcija se ignoriše. */
  showDiscount?: boolean;
  showTotalSummary: boolean;
  includeLogo?: boolean;
  logoBase64?: string | null;
  companyName?: string;
}

type JsPdfWithTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function formatPdfMoney(value: number): string {
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

const COLUMN_WIDTHS = {
  name: 110,
  net: 38,
  gross: 38,
};

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

function brandHeaderRow(label: string, withSpacer: boolean): RowInput[] {
  const rows: RowInput[] = [];

  if (withSpacer) {
    rows.push([
      {
        content: "",
        colSpan: 3,
        styles: {
          fillColor: COLORS.white,
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
      colSpan: 3,
      styles: {
        fillColor: COLORS.brand,
        textColor: COLORS.white,
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

function buildTableBody(items: QuoteItemWithProduct[]): RowInput[] {
  const groups = groupQuoteItemsByBrand(items);
  const body: RowInput[] = [];
  let productStripe = false;

  groups.forEach((group, groupIndex) => {
    body.push(...brandHeaderRow(group.label, groupIndex > 0));

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

      const fillColor = productStripe ? COLORS.stripe : COLORS.white;
      productStripe = !productStripe;

      body.push([
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
        } as CellDef,
        {
          content: formatPdfMoney(netWithDiscount),
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
        } as CellDef,
        {
          content: formatPdfMoney(grossWithDiscount),
          styles: {
            fillColor,
            fontSize: 6,
            halign: "right",
            valign: "middle",
            cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 1 },
            minCellHeight: 5,
          },
        } as CellDef,
      ]);
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

  const headerTop = PAGE_MARGIN;
  const metaX = PAGE_MARGIN + CONTENT_WIDTH;

  setPdfFont(doc, "normal", 10);
  doc.setTextColor(...COLORS.muted);
  doc.text(companyName, metaX, headerTop + 4, { align: "right" });

  setPdfFont(doc, "bold", 24);
  doc.setTextColor(...COLORS.ink);
  doc.text("PONUDA", metaX, headerTop + 15, { align: "right" });

  setPdfFont(doc, "normal", 10);
  doc.setTextColor(...COLORS.muted);
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
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN, blockY, PAGE_MARGIN + CONTENT_WIDTH, blockY);

  setPdfFont(doc, "bold", 11);
  doc.setTextColor(...COLORS.ink);
  doc.text("Kupac", PAGE_MARGIN, blockY + 9);

  setPdfFont(doc, "normal", 11);
  const customerLines = doc.splitTextToSize(
    quote.customer_name,
    CONTENT_WIDTH * 0.55,
  ) as string[];
  doc.text(customerLines, PAGE_MARGIN, blockY + 16);

  return blockY + 16 + customerLines.length * 5 + 6;
}

function drawTotalsBlock(doc: jsPDF, startY: number, finalTotal: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const boxWidth = 72;
  const boxHeight = 22;
  const boxX = PAGE_MARGIN + CONTENT_WIDTH - boxWidth;

  let y = startY + 8;
  if (y + boxHeight > pageHeight - 14) {
    doc.addPage();
    y = PAGE_MARGIN + 8;
  }

  doc.setFillColor(...COLORS.stripe);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxWidth, boxHeight, 2, 2, "FD");

  const labelX = boxX + 5;
  const valueX = boxX + boxWidth - 5;

  setPdfFont(doc, "bold", 9);
  doc.setTextColor(...COLORS.ink);
  doc.text("UKUPNO SA PDV", labelX, y + 10);

  setPdfFont(doc, "bold", 12);
  doc.setTextColor(...COLORS.accent);
  doc.text(
    `${formatPdfMoney(finalTotal)} RSD`,
    valueX,
    y + 10,
    { align: "right" },
  );
}

export async function generateQuotePDF(
  quote: QuoteWithItems,
  options: GenerateQuotePdfOptions,
): Promise<void> {
  if (!quote.items.length) {
    throw new Error("Ponuda nema stavki za export");
  }

  await yieldToMain();

  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsPdfWithTable;
  await registerPdfFonts(doc);

  const tableStartY = await drawHeader(doc, quote, options);
  const finalTotal = sumQuoteGross(quote.items);

  const head = ["Naziv artikla", "Bez PDV", "Sa PDV"];

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 14 },
    tableWidth: CONTENT_WIDTH,
    head: [head],
    body: buildTableBody(quote.items),
    theme: "plain",
    styles: {
      font: PDF_FONT,
      fontSize: 6,
      overflow: "linebreak",
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      lineColor: COLORS.border,
      lineWidth: 0.1,
      textColor: COLORS.ink,
      valign: "middle",
      minCellHeight: 5,
    },
    headStyles: {
      font: PDF_FONT_BOLD,
      fontStyle: "normal",
      fillColor: COLORS.ink,
      textColor: COLORS.white,
      fontSize: 6.5,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      valign: "middle",
      halign: "center",
      minCellHeight: 6,
    },
    columnStyles: {
      0: { cellWidth: COLUMN_WIDTHS.name, halign: "left" },
      1: { cellWidth: COLUMN_WIDTHS.net, halign: "right" },
      2: { cellWidth: COLUMN_WIDTHS.gross, halign: "right" },
    },
    didDrawPage: (data) => {
      setPdfFont(doc, "normal", 7);
      doc.setTextColor(...COLORS.muted);
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
    drawTotalsBlock(doc, finalY, finalTotal);
  }

  await yieldToMain();

  doc.save(buildQuotePdfFileName(quote));
}
