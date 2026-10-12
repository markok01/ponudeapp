import type { Currency } from "@/lib/currency";
import type { QuoteStatus } from "@/lib/quote-status";

export type { QuoteStatus };

export type { Currency };

export interface Product {
  id: number;
  price_list_id: number;
  sku: string;
  name: string;
  category: string | null;
  price: number;
  pdv_percent: number;
  measure_unit: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Quote {
  id: number;
  quote_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_tax_id?: string | null;
  customer_address?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  note: string | null;
  valid_until: string | null;
  currency: Currency;
  status: QuoteStatus;
  created_at: string;
  total: number;
  /** Nacrt čiji snapshot cene više nije jednak trenutnom cenovniku. */
  prices_stale?: boolean;
}

export interface QuoteItem {
  id: number;
  quote_id: number;
  product_id: number;
  qty: number;
  discount_percent: number;
  final_price: number;
}

export interface QuoteItemWithProduct extends QuoteItem {
  sku: string;
  name: string;
  category: string | null;
  unit_price: number;
  pdv_percent: number;
  measure_unit: string | null;
  sort_order: number;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItemWithProduct[];
}

export interface CreateProductInput {
  sku: string;
  name: string;
  category?: string;
  price: number;
  pdv_percent?: number;
  measure_unit?: string | null;
  active?: boolean;
  price_list_id?: number;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  category?: string | null;
  price?: number;
  pdv_percent?: number;
  measure_unit?: string | null;
  active?: boolean;
}

export interface CreateQuoteItemInput {
  product_id: number;
  qty?: number;
  discount_percent: number;
}

export interface CreateQuoteInput {
  customer_id?: number | null;
  customer_name: string;
  note?: string | null;
  valid_until?: string | null;
  currency?: Currency;
  items: CreateQuoteItemInput[];
}

export interface UpdateQuoteInput extends CreateQuoteInput {}

export interface QuoteLineDraft {
  product: Product;
  discount_percent: number;
  qty: number;
}

export interface Customer {
  id: number;
  name: string;
  tax_id: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  quote_count: number;
  created_at: string;
}

export interface CustomerInput {
  name: string;
  tax_id?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export type AppLocale = "sr" | "en";

/** Boje cenovnika (UI + PDF/Excel export). */
export interface CatalogColorPalette {
  /** Pozadina reda brenda/kategorije */
  brandBg: string;
  brandText: string;
  /** Pozadina zaglavlja kolona */
  headerBg: string;
  headerText: string;
  /** Boja cene u tabeli */
  price: string;
  /** Boja ukupnog iznosa */
  priceTotal: string;
}

export type CatalogThemePreset = "default" | "silbo" | "custom";

export interface AppSettings {
  logoDataUrl: string | null;
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  bankAccount: string;
  stampDataUrl: string | null;
  /** Običan član sme da označi ponudu kao poslatu, prihvaćenu ili da je vrati u nacrt. */
  membersCanLockQuotes: boolean;
  locale: AppLocale;
  currency: Currency;
  /** Preset ili ručne boje cenovnika. */
  catalogThemePreset: CatalogThemePreset;
  /** Koristi se kad je preset = custom (inače se ignoriše pri resolve). */
  catalogColors: CatalogColorPalette;
}

export type PriceListTemplate = "empty" | "simple" | "horeca";

export interface PriceListRecord {
  id: number;
  name: string;
  template: PriceListTemplate;
  currency: Currency;
  file_name: string | null;
  active: boolean;
  archived: boolean;
  product_count: number;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  removed_count: number;
  has_snapshot: boolean;
  uploaded_at: string;
}

export interface ImportPreviewDiff {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  sampleAdded: { sku: string; name: string; price: number }[];
  sampleUpdated: { sku: string; name: string; oldPrice: number; newPrice: number }[];
  sampleRemoved: { sku: string; name: string; price: number }[];
}
