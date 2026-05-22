/**
 * Jedinstven šema za Excel cenovnik (export iz Proizvodi, PDF→Excel, uvoz).
 * Kolone se mapiraju isključivo po nazivu header-a, ne po poziciji objekta.
 */

import type { PriceListRow } from "@/types/price-list";

/** Fiksni redosled kolona u fajlu (ne menjati). */
export const CATALOG_EXCEL_COLUMNS = [
  "sku",
  "name",
  "category",
  "price",
  "pdv",
  "unit",
] as const;

export type CatalogExcelColumn = (typeof CATALOG_EXCEL_COLUMNS)[number];

/** Prikaz u Excel-u (srpski headeri). */
export const CATALOG_EXCEL_HEADERS: Record<CatalogExcelColumn, string> = {
  sku: "Šifra",
  name: "Artikal",
  category: "Brend",
  price: "Cena bez PDV",
  pdv: "PDV %",
  unit: "Jedinica",
};

/** Interni ključevi za mapiranje pri uvozu (normalizeHeaderKey). */
export const CATALOG_HEADER_ALIASES: Record<CatalogExcelColumn, readonly string[]> = {
  sku: ["sku", "sifra", "šifra", "sifraartikla"],
  name: ["name", "naziv", "artikal", "productname", "proizvod"],
  category: ["category", "kategorija", "brend", "brand"],
  price: ["price", "cena", "cenabezpdv", "pc", "vpc", "netocena"],
  pdv: ["pdv", "porez", "vat"],
  unit: ["unit", "jedinica", "mjera"],
};

export const CATALOG_REQUIRED_COLUMNS: CatalogExcelColumn[] = [
  "sku",
  "name",
  "price",
];

export type CatalogImportWarning = {
  sku: string;
  message: string;
};

export function catalogHeaderRowValues(): string[] {
  return CATALOG_EXCEL_COLUMNS.map((col) => CATALOG_EXCEL_HEADERS[col]);
}

export function catalogRowToExcelValues(row: {
  sku: string;
  name: string;
  category: string | null;
  price: number;
  pdv_percent?: number;
  measure_unit?: string | null;
}): (string | number)[] {
  return [
    row.sku,
    row.name,
    row.category ?? "",
    row.price,
    row.pdv_percent ?? 20,
    row.measure_unit ?? "kom",
  ];
}

const PRICE_LIKE_IN_LABEL =
  /^\d{1,3}([.,]\d{3})*([.,]\d{1,2})?$|^\d+([.,]\d{1,2})?$/;

/** Osnovna provera da name/category nisu zamenjeni ili očigledno pogrešni. */
export function validateCatalogImportRow(
  row: Pick<PriceListRow, "sku" | "name" | "category" | "price">,
): CatalogImportWarning[] {
  const warnings: CatalogImportWarning[] = [];
  const name = row.name?.trim() ?? "";
  const category = row.category?.trim() ?? "";

  if (name && category && name.toLowerCase() === category.toLowerCase()) {
    warnings.push({
      sku: row.sku,
      message: "Artikal i Brend su identični — moguće zamenjeno mapiranje",
    });
  }

  if (category && PRICE_LIKE_IN_LABEL.test(category.replace(/\s/g, ""))) {
    warnings.push({
      sku: row.sku,
      message: `Brend izgleda kao cena: "${category}"`,
    });
  }

  if (name && PRICE_LIKE_IN_LABEL.test(name.replace(/\s/g, "")) && name.length < 16) {
    warnings.push({
      sku: row.sku,
      message: `Artikal izgleda kao cena: "${name}"`,
    });
  }

  return warnings;
}

export function logCatalogImportDebug(
  label: string,
  rows: PriceListRow[],
  warnings: CatalogImportWarning[],
): void {
  if (process.env.NODE_ENV === "production" && !process.env.CATALOG_EXCEL_DEBUG) {
    return;
  }

  const preview = rows.slice(0, 5).map((r) => ({
    sku: r.sku,
    name: r.name,
    category: r.category,
    price: r.price,
  }));

  console.info(`[catalog-excel] ${label}`, { previewRows: preview });

  if (warnings.length) {
    console.warn(
      `[catalog-excel] ${label} — upozorenja (prvih 10):`,
      warnings.slice(0, 10),
    );
  }
}
