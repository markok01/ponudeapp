import type { QuoteLineDraft } from "@/types";

export interface QuoteBuilderDraft {
  customerName: string;
  note: string;
  validUntil: string;
  lines: QuoteLineDraft[];
}

export function quoteDraftStorageKey(quoteId?: number): string {
  return quoteId ? `ponudeapp-quote-edit-${quoteId}` : "ponudeapp-quote-new";
}

export function loadQuoteDraft(key: string): QuoteBuilderDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as QuoteBuilderDraft;
  } catch {
    return null;
  }
}

export function saveQuoteDraft(key: string, draft: QuoteBuilderDraft): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

export function clearQuoteDraft(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(key);
}

export function hasInvalidDiscount(lines: QuoteLineDraft[]): boolean {
  return lines.some((l) => l.discount_percent < 0 || l.discount_percent > 100);
}
