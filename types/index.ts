export interface Product {
  id: number;
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
  customer_name: string;
  note: string | null;
  valid_until: string | null;
  created_at: string;
  total: number;
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
  customer_name: string;
  note?: string | null;
  valid_until?: string | null;
  items: CreateQuoteItemInput[];
}

export interface UpdateQuoteInput extends CreateQuoteInput {}

export interface QuoteLineDraft {
  product: Product;
  discount_percent: number;
  qty: number;
}

export type AppLocale = "sr" | "en";

export interface AppSettings {
  logoDataUrl: string | null;
  companyName: string;
  locale: AppLocale;
}

export interface PriceListRecord {
  id: number;
  name: string;
  file_name: string | null;
  active: boolean;
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
