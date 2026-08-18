import type { Locale } from "@/lib/i18n/types";

export const CURRENCIES = ["RSD", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "RSD";

const NUMBER_LOCALES: Record<Currency, string> = {
  RSD: "sr-RS",
  EUR: "de-DE",
  USD: "en-US",
};

export function isCurrency(value: unknown): value is Currency {
  return value === "RSD" || value === "EUR" || value === "USD";
}

export function normalizeCurrency(value: unknown): Currency {
  if (typeof value !== "string") return DEFAULT_CURRENCY;
  const upper = value.trim().toUpperCase();
  return isCurrency(upper) ? upper : DEFAULT_CURRENCY;
}

export function defaultCurrencyForLocale(locale: Locale | string | null | undefined): Currency {
  return locale === "en" ? "EUR" : "RSD";
}

export function currencyNumberLocale(currency: Currency): string {
  return NUMBER_LOCALES[currency];
}

export function excelCurrencyNumFmt(currency: Currency): string {
  return `#,##0.00 "${currency}"`;
}

/** Prikaz p.c. u HoReCa tabeli: din/kom, €/kom, $/kom. Merna jedinica ostaje /kom. */
export function catalogPriceUnit(currency: Currency = DEFAULT_CURRENCY): string {
  if (currency === "EUR") return "€/kom";
  if (currency === "USD") return "$/kom";
  return "din/kom";
}

export const PLAN_PRICES = {
  starter: { RSD: 1990, EUR: 17, USD: 19 },
  pro: { RSD: 4990, EUR: 42, USD: 49 },
  business: { RSD: 9990, EUR: 85, USD: 99 },
} as const;
