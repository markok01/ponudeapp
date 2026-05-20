"use client";

import { Trash2 } from "lucide-react";
import { ResizableColumnHead } from "@/components/quotes/resizable-column-head";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { QuoteColumnKey } from "@/lib/quote-workspace-layout";
import type { QuoteLineDraft } from "@/types";
import { formatCurrency } from "@/utils/format";
import {
  quoteLineGrossAfterDiscount,
  unitPriceWithPdv,
} from "@/utils/prices";

interface QuoteLinesTableProps {
  lines: QuoteLineDraft[];
  activeProductId: number | null;
  discountInputValue: (productId: number, stored: number) => string;
  onDiscountChange: (productId: number, raw: string) => void;
  onDiscountBlur: (productId: number) => void;
  onRemove: (productId: number) => void;
}

function QuoteDataCell({
  colKey,
  children,
  className,
  align = "left",
}: {
  colKey: QuoteColumnKey;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const { layout, quoteCellMetrics } = useQuoteWorkspaceLayout();
  const m = quoteCellMetrics(colKey);

  return (
    <td
      className={cn(
        "border-b border-border/50 align-top",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className,
      )}
      style={{
        width: layout.quoteCols[colKey],
        height: layout.rowHeightPx,
        maxHeight: layout.rowHeightPx,
        fontSize: m.fontPx,
        lineHeight: 1.2,
        paddingTop: m.paddingYPx,
        paddingBottom: m.paddingYPx,
        paddingLeft: 6,
        paddingRight: 6,
      }}
    >
      {children}
    </td>
  );
}

export function QuoteLinesTable({
  lines,
  activeProductId,
  discountInputValue,
  onDiscountChange,
  onDiscountBlur,
  onRemove,
}: QuoteLinesTableProps) {
  const t = useTranslations();
  const { layout, resizeQuoteCol, quoteCellMetrics } = useQuoteWorkspaceLayout();
  const cols = layout.quoteCols;
  const rowH = layout.rowHeightPx;
  const discMetrics = quoteCellMetrics("discount");

  return (
    <div className="quote-lines-scroll min-h-0 flex-1 overflow-auto overscroll-contain rounded-[var(--radius-md)] border border-border/80">
      <table
        className="quote-lines-table w-full border-collapse"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: cols.sku }} />
          <col style={{ width: cols.name }} />
          <col style={{ width: cols.exVat }} />
          <col style={{ width: cols.incVat }} />
          <col style={{ width: cols.discount }} />
          <col style={{ width: cols.total }} />
          <col style={{ width: cols.actions }} />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-muted/95 shadow-sm backdrop-blur-sm">
          <tr>
            <ResizableColumnHead
              align="center"
              onResize={(d) => resizeQuoteCol("sku", d)}
            >
              {t("catalog.sku")}
            </ResizableColumnHead>
            <ResizableColumnHead onResize={(d) => resizeQuoteCol("name", d)}>
              {t("quotes.name")}
            </ResizableColumnHead>
            <ResizableColumnHead
              align="right"
              onResize={(d) => resizeQuoteCol("exVat", d)}
            >
              {t("quotes.exVat")}
            </ResizableColumnHead>
            <ResizableColumnHead
              align="right"
              onResize={(d) => resizeQuoteCol("incVat", d)}
            >
              {t("quotes.incVat")}
            </ResizableColumnHead>
            <ResizableColumnHead onResize={(d) => resizeQuoteCol("discount", d)}>
              {t("quotes.discount")}
            </ResizableColumnHead>
            <ResizableColumnHead
              align="right"
              onResize={(d) => resizeQuoteCol("total", d)}
            >
              {t("common.total")}
            </ResizableColumnHead>
            <th
              className="border border-border/50"
              style={{ width: cols.actions, height: rowH }}
            />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const grossLine = quoteLineGrossAfterDiscount(
              line.product.price,
              line.discount_percent,
              line.product.pdv_percent,
              1,
            );
            const badDiscount =
              line.discount_percent < 0 || line.discount_percent > 100;
            const isHighlighted = activeProductId === line.product.id;

            return (
              <tr
                key={line.product.id}
                className={cn(
                  "quote-line-row",
                  isHighlighted && "bg-primary/10",
                )}
                style={{ height: rowH }}
              >
                <QuoteDataCell colKey="sku" className="font-mono text-muted-foreground">
                  {line.product.sku}
                </QuoteDataCell>
                <QuoteDataCell colKey="name" className="font-medium">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                    {line.product.name}
                  </span>
                </QuoteDataCell>
                <QuoteDataCell colKey="exVat" align="right" className="tabular-nums">
                  {formatCurrency(line.product.price)}
                </QuoteDataCell>
                <QuoteDataCell colKey="incVat" align="right" className="tabular-nums">
                  {formatCurrency(
                    unitPriceWithPdv(
                      line.product.price,
                      line.product.pdv_percent,
                    ),
                  )}
                </QuoteDataCell>
                <QuoteDataCell colKey="discount">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className={cn(
                      "w-full min-w-0 px-1 tabular-nums",
                      badDiscount && "border-destructive",
                    )}
                    style={{
                      height: Math.max(20, rowH - 8),
                      fontSize: discMetrics.fontPx,
                    }}
                    value={discountInputValue(
                      line.product.id,
                      line.discount_percent,
                    )}
                    onChange={(e) =>
                      onDiscountChange(line.product.id, e.target.value)
                    }
                    onBlur={() => onDiscountBlur(line.product.id)}
                  />
                </QuoteDataCell>
                <QuoteDataCell
                  colKey="total"
                  align="right"
                  className="font-semibold tabular-nums text-primary"
                >
                  {formatCurrency(grossLine)}
                </QuoteDataCell>
                <td
                  className="border-b border-border/50 px-0.5 align-middle"
                  style={{ width: cols.actions, height: rowH }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    style={{
                      width: Math.max(24, rowH - 6),
                      height: Math.max(24, rowH - 6),
                    }}
                    onClick={() => onRemove(line.product.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
