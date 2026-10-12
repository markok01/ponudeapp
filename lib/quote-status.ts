export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const STORED: QuoteStatus[] = ["draft", "sent", "accepted", "rejected"];

export function parseQuoteStatus(value: unknown): QuoteStatus {
  if (
    value === "draft" ||
    value === "sent" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "expired"
  ) {
    return value;
  }
  return "draft";
}

export function isStoredQuoteStatus(value: unknown): value is Exclude<QuoteStatus, "expired"> {
  return STORED.includes(value as QuoteStatus);
}

export function isQuoteLocked(status: QuoteStatus): boolean {
  return status !== "draft";
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Poslata ponuda posle roka važenja prikazuje se kao istekla. Status u bazi ostaje sent. */
export function quoteDisplayStatus(quote: {
  status: QuoteStatus;
  valid_until: string | null;
}): QuoteStatus {
  if (
    quote.status === "sent" &&
    quote.valid_until &&
    quote.valid_until.slice(0, 10) < todayIso()
  ) {
    return "expired";
  }
  return quote.status;
}
