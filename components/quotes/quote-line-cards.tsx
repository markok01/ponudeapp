"use client";

import { useMemo, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuoteDiscountInput } from "@/components/quotes/quote-discount-input";
import { InfoHint } from "@/components/ui/info-hint";
import { Label } from "@/components/ui/label";
import { TruncatedProductName } from "@/components/ui/product-name-tooltip";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { QuoteLineDraft } from "@/types";
import { type Currency } from "@/lib/currency";
import { formatCurrency } from "@/utils/format";
import {
  quoteLineGrossAfterDiscount,
  quoteLineNetAfterDiscount,
} from "@/utils/prices";
import { handleDiscountInputKeyDown } from "@/utils/quote-line-discount-nav";

interface QuoteLineCardsProps {
  lines: QuoteLineDraft[];
  currency: Currency;
  activeProductId: number | null;
  discountInputValue: (productId: number, stored: number) => string;
  onDiscountChange: (productId: number, raw: string) => void;
  onDiscountBlur: (productId: number) => void;
  onRemove: (productId: number) => void;
  invalidDiscountIds?: number[];
}

export function QuoteLineCards({
  lines,
  currency,
  activeProductId,
  discountInputValue,
  onDiscountChange,
  onDiscountBlur,
  onRemove,
  invalidDiscountIds = [],
}: QuoteLineCardsProps) {
  const t = useTranslations();
  const listRef = useRef<HTMLDivElement>(null);
  const productIds = useMemo(
    () => lines.map((line) => line.product.id),
    [lines],
  );

  return (
    <div ref={listRef} className="quote-lines-cards space-y-2 lg:hidden">
      {lines.map((line) => {
        const netLine = quoteLineNetAfterDiscount(
          line.product.price,
          line.discount_percent,
          1,
        );
        const grossLine = quoteLineGrossAfterDiscount(
          line.product.price,
          line.discount_percent,
          line.product.pdv_percent,
          1,
        );
        const isHighlighted = activeProductId === line.product.id;
        const badDiscount = invalidDiscountIds.includes(line.product.id);

        return (
          <article
            key={line.product.id}
            className={cn(
              "rounded-[var(--radius-md)] border border-border bg-card px-3 py-2.5",
              isHighlighted && "border-primary/35 bg-accent/50",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] text-muted-foreground">
                  {line.product.sku}
                </p>
                <TruncatedProductName
                  name={line.product.name}
                  lines={2}
                  className="mt-0.5 text-[13px] font-medium leading-snug"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => onRemove(line.product.id)}
                aria-label="Ukloni stavku"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-2 flex items-end justify-between gap-2">
              <div className="min-w-[4.5rem]">
                <Label className="inline-flex items-center gap-1 text-[10px]">
                  {t("quotes.discount")}
                  <InfoHint text={t("help.discount")} label={t("help.aria")} />
                </Label>
                <QuoteDiscountInput
                  data-quote-discount-input={line.product.id}
                  invalid={badDiscount}
                  className="mt-0.5"
                  style={{ height: 32, fontSize: "0.8125rem" }}
                  value={discountInputValue(line.product.id, line.discount_percent)}
                  onChange={(e) => onDiscountChange(line.product.id, e.target.value)}
                  onBlur={() => onDiscountBlur(line.product.id)}
                  onKeyDown={(e) =>
                    handleDiscountInputKeyDown(
                      e,
                      listRef.current,
                      productIds,
                      line.product.id,
                      () => onDiscountBlur(line.product.id),
                    )
                  }
                />
              </div>
              <div className="text-right text-xs tabular-nums">
                <p className="text-[10px] text-muted-foreground">Ukupno bez PDV</p>
                <p className="font-semibold text-price">{formatCurrency(netLine, currency)}</p>
                <p className="text-[10px] text-muted-foreground">
                  sa PDV{" "}
                  <span className="tabular-nums">{formatCurrency(grossLine, currency)}</span>
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
