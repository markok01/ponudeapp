import type { QuoteWithItems } from "@/types";
import { getAppSettings } from "@/lib/app-settings";
import {
  generateQuotePDF,
  type GenerateQuotePdfOptions,
} from "@/utils/generate-quote-pdf";

export type { GenerateQuotePdfOptions };

/** Brzi export (cene sa rabatom, logo iz podešavanja). */
export function exportQuotePdf(quote: QuoteWithItems) {
  const settings = getAppSettings();
  return generateQuotePDF(quote, {
    showTotalSummary: false,
    includeLogo: Boolean(settings.logoDataUrl),
    logoBase64: settings.logoDataUrl,
    companyName: settings.companyName || undefined,
  });
}
