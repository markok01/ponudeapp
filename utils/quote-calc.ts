/** Cena bez PDV-a, posle rabata (jedna stavka, bez količine). */
export function linePriceAfterDiscount(
  unitPrice: number,
  discountPercent: number,
): number {
  return unitPrice * (1 - discountPercent / 100);
}

/** Cena sa PDV-om, posle rabata. */
export function linePriceWithPdv(
  unitPrice: number,
  discountPercent: number,
  pdvPercent: number,
): number {
  return linePriceAfterDiscount(unitPrice, discountPercent) * (1 + pdvPercent / 100);
}

/** Za čuvanje u bazi (ukupno stavke sa PDV). */
export function lineFinalPrice(
  unitPrice: number,
  discountPercent: number,
  pdvPercent: number,
): number {
  return linePriceWithPdv(unitPrice, discountPercent, pdvPercent);
}

export function sumLineTotals(lines: { finalPrice: number }[]): number {
  return lines.reduce((sum, line) => sum + line.finalPrice, 0);
}
