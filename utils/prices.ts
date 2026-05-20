import { linePriceAfterDiscount, linePriceWithPdv } from "@/utils/quote-calc";

/** Cena u cenovniku je bez PDV-a. */
export function unitPriceWithPdv(
  netPrice: number,
  pdvPercent: number,
): number {
  return netPrice * (1 + pdvPercent / 100);
}

export function quoteLineNetAfterDiscount(
  unitPrice: number,
  discountPercent: number,
  qty = 1,
): number {
  return (qty || 1) * linePriceAfterDiscount(unitPrice, discountPercent);
}

export function quoteLineGrossAfterDiscount(
  unitPrice: number,
  discountPercent: number,
  pdvPercent: number,
  qty = 1,
): number {
  return (qty || 1) * linePriceWithPdv(unitPrice, discountPercent, pdvPercent);
}

export type QuotePriceLine = {
  unit_price: number;
  discount_percent: number;
  pdv_percent: number;
  qty?: number;
};

export function sumQuoteNet(items: QuotePriceLine[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      quoteLineNetAfterDiscount(
        item.unit_price,
        item.discount_percent,
        item.qty,
      ),
    0,
  );
}

export function sumQuoteGross(items: QuotePriceLine[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      quoteLineGrossAfterDiscount(
        item.unit_price,
        item.discount_percent,
        item.pdv_percent,
        item.qty,
      ),
    0,
  );
}
