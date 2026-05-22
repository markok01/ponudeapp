"use client";

import { useEffect, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { useContainerWidth } from "@/hooks/use-container-width";
import { ResizableColumnHead } from "@/components/quotes/resizable-column-head";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import { Button } from "@/components/ui/button";
import { QuoteDiscountInput } from "@/components/quotes/quote-discount-input";
import { TruncatedProductName } from "@/components/ui/product-name-tooltip";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import {
  visibleQuoteTableColumns,
  type QuoteColumnKey,
} from "@/lib/quote-workspace-layout";
import type { QuoteLineDraft } from "@/types";
import { formatCurrency } from "@/utils/format";
import {
  quoteLineNetAfterDiscount,
  unitPriceWithPdv,
} from "@/utils/prices";
import { handleDiscountInputKeyDown } from "@/utils/quote-line-discount-nav";

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
  const { layout, quoteCellMetrics, isQuoteFluid } = useQuoteWorkspaceLayout();
  const m = quoteCellMetrics(colKey);

  return (
    <td
      className={cn(
        "catalog-cell border-b border-border/50 align-top",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className,
      )}
      style={{
        width: isQuoteFluid ? undefined : layout.quoteCols[colKey],
        height: m.rowHeightPx,
        maxHeight: m.rowHeightPx,
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
  const {
    layout,
    resizeQuoteCol,
    quoteCellMetrics,
    quoteColStyles,
    quoteTableMinWidth,
    isQuoteFluid,
    hideQuoteIncVat,
    isPanelResizing,
    quotePanelWidth,
    setQuotePanelWidth,
  } = useQuoteWorkspaceLayout();
  const visibleCols = visibleQuoteTableColumns(hideQuoteIncVat);
  const { ref: panelRef, width: measuredWidth } = useContainerWidth<HTMLDivElement>({
    observe: !isPanelResizing,
  });
  const panelWidth = isPanelResizing ? quotePanelWidth : measuredWidth;
  const cols = layout.quoteCols;
  const rowH = layout.rowHeightPx;
  const discMetrics = quoteCellMetrics("discount");
  const productIds = useMemo(
    () => lines.map((line) => line.product.id),
    [lines],
  );

  useEffect(() => {
    setQuotePanelWidth(panelWidth);
  }, [panelWidth, setQuotePanelWidth]);

  return (
    <div
      ref={panelRef}
      className="quote-lines-scroll catalog-scroll-wrap min-h-0 flex-1 overflow-auto overscroll-contain rounded-[var(--radius-md)] border border-border/80"
      data-catalog-fluid={isQuoteFluid ? "true" : "false"}
    >
      <table
        className="quote-lines-table catalog-table w-full border-collapse text-sm"
        style={{
          tableLayout: "fixed",
          minWidth: quoteTableMinWidth,
          width: isQuoteFluid ? "100%" : quoteTableMinWidth,
        }}
      >
        <colgroup>
          {visibleCols.map((key) => (
            <col key={key} style={{ width: quoteColStyles[key] }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-muted/95 shadow-sm backdrop-blur-sm">
          <tr>
            <ResizableColumnHead
              variant="quote"
              align="center"
              onResize={(d) => resizeQuoteCol("sku", d)}
            >
              {t("catalog.sku")}
            </ResizableColumnHead>
            <ResizableColumnHead
              variant="quote"
              onResize={(d) => resizeQuoteCol("name", d)}
            >
              {t("quotes.name")}
            </ResizableColumnHead>
            <ResizableColumnHead
              variant="quote"
              align="right"
              onResize={(d) => resizeQuoteCol("exVat", d)}
            >
              {t("quotes.exVat")}
            </ResizableColumnHead>
            {!hideQuoteIncVat ? (
              <ResizableColumnHead
                variant="quote"
                align="right"
                onResize={(d) => resizeQuoteCol("incVat", d)}
              >
                {t("quotes.incVat")}
              </ResizableColumnHead>
            ) : null}
            <ResizableColumnHead
              variant="quote"
              onResize={(d) => resizeQuoteCol("discount", d)}
            >
              {t("quotes.discount")}
            </ResizableColumnHead>
            <ResizableColumnHead
              variant="quote"
              align="right"
              onResize={(d) => resizeQuoteCol("total", d)}
            >
              {t("common.total")}
            </ResizableColumnHead>
            <th
              className="catalog-cell border border-border/50"
              style={{ width: quoteColStyles.actions, height: rowH }}
            />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const netLineTotal = quoteLineNetAfterDiscount(
              line.product.price,
              line.discount_percent,
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
                  <TruncatedProductName
                    name={line.product.name}
                    className="font-medium"
                  />
                </QuoteDataCell>
                <QuoteDataCell
                  colKey="exVat"
                  align="right"
                  className="overflow-hidden text-ellipsis whitespace-nowrap tabular-nums font-semibold text-price"
                >
                  {formatCurrency(line.product.price)}
                </QuoteDataCell>
                {!hideQuoteIncVat ? (
                  <QuoteDataCell
                    colKey="incVat"
                    align="right"
                    className="overflow-hidden text-ellipsis whitespace-nowrap tabular-nums"
                  >
                    {formatCurrency(
                      unitPriceWithPdv(
                        line.product.price,
                        line.product.pdv_percent,
                      ),
                    )}
                  </QuoteDataCell>
                ) : null}
                <QuoteDataCell
                  colKey="discount"
                  align="center"
                  className="px-0.5 align-middle"
                >
                  <QuoteDiscountInput
                    data-quote-discount-input={line.product.id}
                    invalid={badDiscount}
                    style={{
                      height: Math.max(22, rowH - 6),
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
                    onKeyDown={(e) =>
                      handleDiscountInputKeyDown(
                        e,
                        panelRef.current,
                        productIds,
                        line.product.id,
                        () => onDiscountBlur(line.product.id),
                      )
                    }
                  />
                </QuoteDataCell>
                <QuoteDataCell
                  colKey="total"
                  align="right"
                  className="overflow-hidden text-ellipsis whitespace-nowrap tabular-nums font-semibold text-price"
                >
                  {formatCurrency(netLineTotal)}
                </QuoteDataCell>
                <td
                  className="catalog-cell border-b border-border/50 px-0.5 align-middle"
                  style={{
                    width: isQuoteFluid ? undefined : cols.actions,
                    height: rowH,
                  }}
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
