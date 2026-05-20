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
import { getQuoteLabel } from "@/utils/format-quote-number";
import { inferMeasureUnit } from "@/utils/measure-unit";
import {
  linePriceAfterDiscount,
  linePriceWithPdv,
} from "@/utils/quote-calc";
import { sumQuoteGross } from "@/utils/prices";

const TABLE_RADIUS = 3;
/** Širina tabele — kolone moraju tačno da zbiraju ovu vrednost */
const TABLE_WIDTH = 182;

/** Diskretna pastel paleta — malo tamnija, i dalje blaga */
const C = {
  ink: [44, 51, 69] as [number, number, number],
  muted: [107, 114, 137] as [number, number, number],
  line: [210, 218, 230] as [number, number, number],
  soft: [232, 236, 244] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  head: [214, 222, 238] as [number, number, number],
  group: [220, 216, 234] as [number, number, number],
  groupText: [72, 66, 92] as [number, number, number],
  accent: [91, 141, 239] as [number, number, number],
};

export interface GenerateQuotePdfOptions {
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

function formatPdfDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sr-RS", { dateStyle: "medium" }).format(date);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\s-čćžšđČĆŽŠĐ]/gi, "").replace(/\s+/g, "-");
}

const COL_W = { name: 98, unit: 14, net: 35, gross: 35 };

function groupQuoteItemsByBrand(
  items: QuoteItemWithProduct[],
): { label: string; items: QuoteItemWithProduct[] }[] {
  const sorted = [...items].sort((a, b) => {
    const o = a.sort_order - b.sort_order;
    return o !== 0 ? o : a.id - b.id;
  });
  const groups: { label: string; items: QuoteItemWithProduct[] }[] = [];
  for (const item of sorted) {
    const label = item.category?.trim() || "Ostalo";
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function brandHeaderRow(label: string, withGap: boolean): RowInput[] {
  const rows: RowInput[] = [];
  if (withGap) {
    rows.push([
      {
        content: "",
        colSpan: 4,
        styles: { fillColor: C.white, lineWidth: 0, minCellHeight: 2, cellPadding: 0 },
      },
    ]);
  }
  rows.push([
    {
      content: label.toUpperCase(),
      colSpan: 4,
      styles: {
        fillColor: C.group,
        textColor: C.groupText,
        font: PDF_FONT_BOLD,
        fontStyle: "normal",
        fontSize: 6.5,
        halign: "center",
        valign: "middle",
        cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
        minCellHeight: 5,
      },
    },
  ]);
  return rows;
}

function buildTableBody(items: QuoteItemWithProduct[]): RowInput[] {
  const body: RowInput[] = [];
  let stripe = false;

  groupQuoteItemsByBrand(items).forEach((group, gi) => {
    body.push(...brandHeaderRow(group.label, gi > 0));

    for (const item of group.items) {
      const qty = item.qty || 1;
      const net =
        linePriceAfterDiscount(item.unit_price, item.discount_percent) * qty;
      const gross =
        linePriceWithPdv(
          item.unit_price,
          item.discount_percent,
          item.pdv_percent,
        ) * qty;
      const name =
        qty > 1 ? `${item.name} (${qty} kom)` : item.name;
      const bg = stripe ? C.soft : C.white;
      stripe = !stripe;

      body.push([
        {
          content: name,
          styles: {
            fillColor: bg,
            textColor: C.ink,
            font: PDF_FONT,
            fontStyle: "normal",
            fontSize: 6.5,
            cellPadding: { top: 2, right: 2.5, bottom: 2, left: 3 },
            minCellHeight: 5.5,
            overflow: "linebreak",
          },
        } as CellDef,
        {
          content:
            item.measure_unit?.trim() ||
            inferMeasureUnit(item.name, item.category),
          styles: {
            fillColor: bg,
            textColor: C.muted,
            fontSize: 6,
            halign: "center",
            valign: "middle",
            cellPadding: { top: 2, right: 1, bottom: 2, left: 1 },
            minCellHeight: 5.5,
          },
        } as CellDef,
        {
          content: formatPdfMoney(net),
          styles: {
            fillColor: bg,
            textColor: C.ink,
            fontSize: 6,
            halign: "right",
            valign: "middle",
            cellPadding: { top: 2, right: 2.5, bottom: 2, left: 1 },
            minCellHeight: 5.5,
          },
        } as CellDef,
        {
          content: formatPdfMoney(gross),
          styles: {
            fillColor: bg,
            textColor: C.ink,
            font: PDF_FONT_BOLD,
            fontStyle: "normal",
            fontSize: 6,
            halign: "right",
            valign: "middle",
            cellPadding: { top: 2, right: 2.5, bottom: 2, left: 1 },
            minCellHeight: 5.5,
          },
        } as CellDef,
      ]);
    }
  });

  return body;
}

async function yieldToMain(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}

function contentMargins(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = (pageW - TABLE_WIDTH) / 2;
  return { marginX, rightX: marginX + TABLE_WIDTH, pageW };
}

async function drawHeader(
  doc: jsPDF,
  quote: QuoteWithItems,
  options: GenerateQuotePdfOptions,
): Promise<number> {
  const company =
    options.companyName?.trim() ||
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    "PonudeApp";

  const { marginX, rightX } = contentMargins(doc);
  let leftBottom = marginX;

  if (options.includeLogo && options.logoBase64) {
    try {
      const { width, height } = await loadImageDimensions(options.logoBase64);
      const box = fitImageBox(width, height, 42, 18);
      const fmt = options.logoBase64.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(
        options.logoBase64,
        fmt,
        marginX,
        marginX,
        box.width,
        box.height,
        undefined,
        "FAST",
      );
      leftBottom = marginX + box.height;
    } catch {
      /* skip */
    }
  }

  const metaTop = marginX + 4;

  setPdfFont(doc, "normal", 7.5);
  doc.setTextColor(...C.muted);
  doc.text("PONUDA", rightX, metaTop, { align: "right" });

  setPdfFont(doc, "bold", 11);
  doc.setTextColor(...C.ink);
  doc.text(company, rightX, metaTop + 6, { align: "right" });

  setPdfFont(doc, "normal", 8.5);
  doc.setTextColor(...C.muted);
  let metaY = metaTop + 13;
  doc.text(`Datum: ${formatPdfDate(quote.created_at)}`, rightX, metaY, {
    align: "right",
  });
  metaY += 5;
  doc.text(`Broj: ${getQuoteLabel(quote)}`, rightX, metaY, { align: "right" });
  if (quote.valid_until) {
    metaY += 5;
    doc.text(`Važi do: ${formatPdfDate(quote.valid_until)}`, rightX, metaY, {
      align: "right",
    });
  }

  const headerBottom = Math.max(leftBottom, metaY) + 8;

  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.25);
  doc.line(marginX, headerBottom, rightX, headerBottom);

  const customerLines = doc.splitTextToSize(
    quote.customer_name,
    TABLE_WIDTH - 8,
  ) as string[];
  const blockY = headerBottom + 6;

  setPdfFont(doc, "normal", 7);
  doc.setTextColor(...C.muted);
  doc.text("Kupac", marginX, blockY);

  setPdfFont(doc, "bold", 11);
  doc.setTextColor(...C.ink);
  doc.text(customerLines, marginX, blockY + 5.5);

  return blockY + 5.5 + customerLines.length * 5 + 8;
}

function drawTableFrame(
  doc: jsPDF,
  marginX: number,
  topY: number,
  bottomY: number,
) {
  const inset = 0.6;
  const x = marginX - inset;
  const w = TABLE_WIDTH + inset * 2;
  const h = bottomY - topY + inset * 2;
  if (h <= 0) return;

  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, topY - inset, w, h, TABLE_RADIUS, TABLE_RADIUS, "S");
}

function drawTotalsBlock(
  doc: jsPDF,
  marginX: number,
  startY: number,
  total: number,
) {
  const pageH = doc.internal.pageSize.getHeight();
  const w = 70;
  const h = 14;
  const x = marginX + TABLE_WIDTH - w;

  let y = startY + 8;
  if (y + h > pageH - 14) {
    doc.addPage();
    y = marginX + 8;
  }

  doc.setFillColor(...C.soft);
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");

  setPdfFont(doc, "normal", 7.5);
  doc.setTextColor(...C.muted);
  doc.text("Ukupno sa PDV", x + 4, y + 5.5);

  setPdfFont(doc, "bold", 11);
  doc.setTextColor(...C.ink);
  doc.text(`${formatPdfMoney(total)} RSD`, x + w - 4, y + 5.5, {
    align: "right",
  });
}

function drawFooter(
  doc: jsPDF,
  quote: QuoteWithItems,
  page: number,
  totalPages: number,
) {
  const { marginX, rightX } = contentMargins(doc);
  const footerY = doc.internal.pageSize.getHeight() - 7;
  const note = quote.note?.trim();

  if (note && page === totalPages) {
    setPdfFont(doc, "normal", 7);
    doc.setTextColor(...C.muted);
    const lines = doc.splitTextToSize(
      `Napomena: ${note}`,
      TABLE_WIDTH * 0.7,
    ) as string[];
    doc.text(lines, marginX, footerY - 4 - (lines.length - 1) * 3.5);
  }

  setPdfFont(doc, "normal", 7);
  doc.setTextColor(...C.muted);
  doc.text(`Strana ${page} / ${totalPages}`, rightX, footerY, {
    align: "right",
  });
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
  const total = sumQuoteGross(quote.items);
  const { marginX } = contentMargins(doc);
  const frameTop = tableStartY - 2;
  const pageW = doc.internal.pageSize.getWidth();
  const marginRight = pageW - marginX - TABLE_WIDTH;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginX, right: marginRight, bottom: 14 },
    tableWidth: TABLE_WIDTH,
    head: [["Naziv artikla", "M.j.", "Bez PDV", "Sa PDV"]],
    body: buildTableBody(quote.items),
    theme: "plain",
    styles: {
      font: PDF_FONT,
      fontSize: 6,
      overflow: "linebreak",
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2.5 },
      lineColor: C.line,
      lineWidth: 0.1,
      textColor: C.ink,
      valign: "middle",
      minCellHeight: 5.5,
    },
    headStyles: {
      font: PDF_FONT_BOLD,
      fontStyle: "normal",
      fillColor: C.head,
      textColor: C.ink,
      fontSize: 6.5,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      halign: "center",
      valign: "middle",
      minCellHeight: 6,
    },
    columnStyles: {
      0: { cellWidth: COL_W.name, halign: "left" },
      1: { cellWidth: COL_W.unit, halign: "center" },
      2: { cellWidth: COL_W.net, halign: "right" },
      3: { cellWidth: COL_W.gross, halign: "right" },
    },
    didDrawPage: (data) => {
      drawFooter(doc, quote, data.pageNumber, doc.getNumberOfPages());
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? tableStartY + 40;
  drawTableFrame(doc, marginX, frameTop, tableEndY);

  if (options.showTotalSummary) {
    drawTotalsBlock(doc, marginX, tableEndY, total);
  }

  await yieldToMain();
  doc.save(`${getQuoteLabel(quote)}-${sanitizeFileName(quote.customer_name)}.pdf`);
}
