import {
  type Currency,
  currencyNumberLocale,
  DEFAULT_CURRENCY,
  normalizeCurrency,
} from "@/lib/currency";

export function formatCurrency(
  value: number,
  currency: Currency | string = DEFAULT_CURRENCY,
): string {
  const code = normalizeCurrency(currency);
  return new Intl.NumberFormat(currencyNumberLocale(code), {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sr-RS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
