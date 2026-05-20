export interface PriceListRow {
  sku: string;
  name: string;
  category: string | null;
  price: number;
  pdv_percent?: number;
  /** Red u Excel cenovniku (0-based), za identičan redosled prikaza. */
  sort_order?: number;
}

export interface PriceListImportResult {
  rows: PriceListRow[];
  source: "xlsx" | "pdf";
  convertedFromPdf: boolean;
}
