"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { QuoteLineDraft } from "@/types";
import { formatCurrency } from "@/utils/format";
import {
  quoteLineGrossAfterDiscount,
  quoteLineNetAfterDiscount,
} from "@/utils/prices";

interface QuoteLineCardsProps {
  lines: QuoteLineDraft[];
  activeProductId: number | null;
  discountInputValue: (productId: number, stored: number) => string;
  onDiscountChange: (productId: number, raw: string) => void;
  onDiscountBlur: (productId: number) => void;
  onRemove: (productId: number) => void;
  invalidDiscountIds?: number[];
}

export function QuoteLineCards({
  lines,
  activeProductId,
  discountInputValue,
  onDiscountChange,
  onDiscountBlur,
  onRemove,
  invalidDiscountIds = [],
}: QuoteLineCardsProps) {
  return (
    <div className="quote-lines-cards space-y-2 lg:hidden">
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
              "rounded-[var(--radius-md)] border border-border bg-card px-3 py-2.5 shadow-[var(--shadow-soft)]",
              isHighlighted && "border-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] text-muted-foreground">
                  {line.product.sku}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">
                  {line.product.name}
                </p>
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
              <div className="min-w-[5rem]">
                <Label className="text-[10px]">Rabat %</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className={cn("mt-0.5 h-8 text-xs", badDiscount && "border-destructive")}
                  value={discountInputValue(line.product.id, line.discount_percent)}
                  onChange={(e) => onDiscountChange(line.product.id, e.target.value)}
                  onBlur={() => onDiscountBlur(line.product.id)}
                />
              </div>
              <div className="text-right text-xs tabular-nums">
                <p className="text-[10px] text-muted-foreground">Sa PDV</p>
                <p className="font-semibold text-primary">{formatCurrency(grossLine)}</p>
                <p className="text-[10px] text-muted-foreground">
                  bez PDV {formatCurrency(netLine)}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
