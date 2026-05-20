/** Ljudski broj ponude: PON-2026-0042 */
export function formatQuoteNumber(id: number, createdAt: string | Date): string {
  const year = new Date(createdAt).getFullYear();
  return `PON-${year}-${String(id).padStart(4, "0")}`;
}

export function getQuoteLabel(quote: {
  id: number;
  quote_number?: string | null;
  created_at: string;
}): string {
  return quote.quote_number?.trim() || formatQuoteNumber(quote.id, quote.created_at);
}
