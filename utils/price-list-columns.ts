/** Mapiranje kolona srpskog cenovnika (HoReCa: šifra, nova šifra, artikal, p.c., PDV, brend). */

import type { PriceListRow } from "@/types/price-list";

export function normalizeHeaderKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .trim();
}

const SKU_KEYS = new Set(["sku", "sifra", "sifraartikla", "art", "kod", "barkod"]);
const NOVA_SIFRA_KEYS = new Set(["novasifra", "ovasifr", "novasifr"]);
const NAME_KEYS = new Set([
  "name",
  "naziv",
  "artikal",
  "artiakal",
  "proizvod",
  "opis",
  "nazivartikla",
]);
const PRICE_KEYS = new Set([
  "price",
  "cena",
  "pc",
  "vpc",
  "neto",
  "netocena",
  "jcena",
  "jedcena",
  "prodajnacena",
]);
const CATEGORY_KEYS = new Set([
  "category",
  "kategorija",
  "brend",
  "brand",
  "proizvodjac",
  "grupa",
]);
const PDV_KEYS = new Set(["pdv", "porez", "vat", "tax"]);

export type ColumnKind = "sku" | "novaSifra" | "name" | "price" | "category" | "pdv";

export function classifyHeaderKey(normalized: string): ColumnKind | null {
  if (NOVA_SIFRA_KEYS.has(normalized) || (normalized.includes("sifr") && normalized.includes("ova"))) {
    return "novaSifra";
  }
  if (SKU_KEYS.has(normalized)) return "sku";
  if (NAME_KEYS.has(normalized)) return "name";
  if (PRICE_KEYS.has(normalized) || normalized.includes("cena")) return "price";
  if (CATEGORY_KEYS.has(normalized)) return "category";
  if (PDV_KEYS.has(normalized)) return "pdv";
  return null;
}

export function buildHeaderMap(cells: string[]): Partial<Record<ColumnKind, number>> {
  const map: Partial<Record<ColumnKind, number>> = {};
  cells.forEach((cell, i) => {
    const key = normalizeHeaderKey(cell);
    if (!key) return;
    const kind = classifyHeaderKey(key);
    if (kind && map[kind] == null) {
      map[kind] = i + 1;
    }
  });
  return map;
}

/** Red proizvoda (šifra + naziv + cena), ne dekorativni naslov grupe. */
export function rowLooksLikeProductLine(
  sifra: string,
  novaSifra: string,
  name: string,
  price: number | null,
): boolean {
  const sku = resolveSku(sifra, novaSifra).trim();
  const productName = name.trim();
  if (!sku || !productName || price == null) return false;
  if (/^\d{3,8}$/.test(sku)) return true;
  if (/\d{3,}/.test(sku) && productName.length >= 3) return true;
  return sku.length >= 2 && productName.length >= 4 && /\d/.test(sku);
}

/** Table 1/2: šifra | nova šifra | artikal (x2) | tr.pak. | p.c. | PDV */
export const HORECA_WIDE_COLS: Partial<Record<ColumnKind, number>> = {
  sku: 1,
  novaSifra: 2,
  name: 3,
  price: 6,
  pdv: 7,
};

/** Table 3 i nastavci: šifra | nova šifra | artikal | tr.pak. | p.c. | PDV */
export const HORECA_COMPACT_COLS: Partial<Record<ColumnKind, number>> = {
  sku: 1,
  novaSifra: 2,
  name: 3,
  price: 5,
  pdv: 6,
};

/** @deprecated koristi HORECA_WIDE_COLS */
export const HORECA_DEFAULT_COLS = HORECA_WIDE_COLS;

export function isPackColumn(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/tr\.?\s*pak/i.test(s)) return true;
  // Samo kratke ćelije pakovanja (npr. "12 kom."), ne ceo naziv proizvoda koji sadrži "360kom"
  if (s.length > 32) return false;
  return (
    /^\d+([.,]\d+)?\s*(kom|kg|seta|l|ml|g)\.?$/i.test(s) ||
    (/^\d+([.,]\d+)?\s*kom\.?$/i.test(s) && !/din/i.test(s))
  );
}

export function isLikelyPriceRaw(raw: string): boolean {
  const s = raw.trim();
  if (!s || isPackColumn(s)) return false;
  if (/din|rsd|€|eur/i.test(s)) return true;
  const n = parsePriceHint(s);
  if (n == null) return false;
  if (isPdvColumnRaw(raw)) return false;
  return n >= 0.01;
}

export function isPdvColumnRaw(raw: string): boolean {
  const n = parsePriceHint(raw);
  if (n == null) return false;
  return n > 0 && n <= 0.25;
}

export function resolveSku(sifra: string, novaSifra: string): string {
  const a = sifra.trim();
  const b = novaSifra.trim();
  if (b) return b;
  return a;
}

export function isHeaderRowCells(cells: string[]): boolean {
  const lower = cells.map((c) => c.toLowerCase()).join(" ");
  const hasSku = lower.includes("šifra") || lower.includes("sifra");
  const hasName = lower.includes("artikal") || lower.includes("artiakal");
  const hasPrice =
    lower.includes("p.c") || lower.includes("pc") || lower.includes("cena");
  const hasPack = /tr\.?\s*pak/i.test(lower);
  const hasPdv = lower.includes("pdv");
  return hasSku && hasName && hasPrice && (hasPack || hasPdv);
}

/** Ćelija je naslov kolone (šifra, artikal, tr.pak., p.c., PDV), ne naziv brenda. */
export function isCatalogColumnLabel(cell: string): boolean {
  const t = cell.trim();
  if (!t) return true;
  if (/tr\.?\s*pak/i.test(t)) return true;
  const key = normalizeHeaderKey(t);
  return classifyHeaderKey(key) != null;
}

/** Samo naslovi kolona (šifra, artikal, tr.pak., p.c., PDV) — bez imena brenda. */
export function isPureColumnHeaderRow(cells: string[]): boolean {
  const trimmed = cells.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length < 3) return false;
  if (!trimmed.every((c) => isCatalogColumnLabel(c))) return false;
  return isHeaderRowCells(trimmed);
}

const BREND_DASH_IN_TEXT =
  /brend\s*[-–—:]\s*(.+?)(?:\s*[-–—]\s*|$)/i;

function cleanBrandName(raw: string): string | null {
  const name = raw
    .trim()
    .replace(/^['"„«»]+|['"„«»]+$/g, "")
    .trim();
  if (name.length < 2 || name.length >= 80) return null;
  if (/^\d+$/.test(name)) return null;
  if (isCatalogColumnLabel(name)) return null;
  if (/^(šifra|sifra|artikal|p\.?\s*c|pdv|tr\.pak)/i.test(name)) return null;
  return name;
}

/**
 * Eksplicitno: „Brend - WOERLE“, „Brend – ime“, „Brend: ime“ u ćeliji ili spojenom redu.
 */
export function extractBrendDashBrand(cells: string[]): string | null {
  for (const cell of cells) {
    const t = cell.trim();
    if (!/brend\s*[-–—:]/i.test(t)) continue;
    const m = t.match(/^\s*brend\s*[-–—:]\s*(.+)\s*$/i);
    if (m?.[1]) {
      const cleaned = cleanBrandName(m[1]);
      if (cleaned) return cleaned;
    }
  }

  const joined = cells
    .map((c) => c.trim())
    .filter(Boolean)
    .join(" ");
  const m = joined.match(BREND_DASH_IN_TEXT);
  if (m?.[1]) {
    const cleaned = cleanBrandName(m[1]);
    if (cleaned) return cleaned;
  }

  return null;
}

/** Samo ime brenda u redu (bez „Brend -“), npr. ljubičasti naslov WOERLE. */
export function extractStandaloneBrandTitle(cells: string[]): string | null {
  if (cells.some((c) => /brend\s*[-–—:]/i.test(c.trim()))) return null;
  return isBrandRow(cells);
}

/**
 * Red graničnik brenda — proizvodi ispod do sledećeg takvog reda.
 * 1) „Brend - ime“  2) samo „ime brenda“
 */
export function detectBrandMarkerRow(
  cells: string[],
  sifra: string,
  novaSifra: string,
  name: string,
  price: number | null,
): string | null {
  if (rowLooksLikeProductLine(sifra, novaSifra, name, price)) return null;
  if (isPureColumnHeaderRow(cells)) return null;

  const brendDash = extractBrendDashBrand(cells);
  if (brendDash) return brendDash;

  return extractStandaloneBrandTitle(cells);
}

/** Ćelije koje nisu cena/PDV/pakovanje — za ljubičasti naslov grupe. */
function meaningfulBrandCells(cells: string[]): string[] {
  return cells
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => !/din\s*\//i.test(c))
    .filter((c) => !isPackColumn(c))
    .filter((c) => !isPdvColumnRaw(c))
    .filter((c) => !isLikelyPriceRaw(c));
}

/**
 * Ljubičasti / naslovni red brenda (npr. WOERLE, FINE & DELI).
 * PDV u poslednjoj koloni ne sme da spreči prepoznavanje.
 */
export function isBrandRow(cells: string[]): string | null {
  if (isHeaderRowCells(cells)) return null;

  const meaningful = meaningfulBrandCells(cells);
  if (meaningful.length === 0) return null;

  const first = meaningful[0];
  if (/^(šifra|sifra|artikal|artiakal|p\.?\s*c|pdv|tr\.pak)/i.test(first)) {
    return null;
  }

  if (meaningful.length === 1) {
    if (first.length >= 2 && first.length < 80 && !/^\d+$/.test(first)) {
      return first;
    }
    return null;
  }

  const unique = [...new Set(meaningful)];
  if (unique.length === 1 && unique[0].length >= 2 && unique[0].length < 80) {
    return unique[0];
  }

  if (
    meaningful.every((c) => c.toUpperCase() === first.toUpperCase()) &&
    first.length > 2
  ) {
    return first;
  }

  return null;
}

/** Pod-brend ispod glavnog (npr. AIA ZAMRZNUTO), samo kad već postoji brend iz ljubičastog reda. */
export function isSubBrandRow(
  sifra: string,
  novaSifra: string,
  name: string,
  priceRaw: string,
  currentBrand: string | null,
): string | null {
  if (!currentBrand?.trim()) return null;
  if (parsePriceHint(priceRaw) != null) return null;
  if (sifra.trim() && /^\d+$/.test(sifra.trim())) return null;
  if (novaSifra.trim() && /^\d+$/.test(novaSifra.trim())) return null;
  const label = name.trim();
  if (label.length < 2) return null;
  if (/^(šifra|sifra|artikal|p\.?c|pdv|tr\.pak)/i.test(label)) return null;
  if (label.toUpperCase() === currentBrand.trim().toUpperCase()) return null;
  return label;
}

export function parsePriceHint(raw: string): number | null {
  if (!raw?.trim()) return null;

  let s = raw
    .replace(/\s/g, "")
    .replace(/din\/?(kom|kg|seta|l|ml)?\.?/gi, "")
    .replace(/rsd|eur|€/gi, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.+$/g, "");

  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    s = s.replace(/,/g, "");
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(",", ".");
  } else {
    const commas = (s.match(/,/g) || []).length;
    const dots = (s.match(/\./g) || []).length;
    if (commas === 1 && dots === 0) {
      s = s.replace(",", ".");
    } else if (commas >= 1 && dots === 1) {
      s = s.replace(/,/g, "");
    }
  }

  const num = Number(s);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/** PDV iz Excela: 0.1 → 10%, 0.2 → 20%, ili već u procentima. */
export function parsePdvPercent(raw: string): number {
  const n = parsePriceHint(raw);
  if (n == null || n < 0) return 20;
  if (n > 0 && n <= 1) return Math.round(n * 100);
  if (n === 10 || n === 20) return n;
  return 20;
}

/** PDV stopa (0.1, 0.2) — ne sme ući kao cena proizvoda. */
export function isPdvValueAsPrice(price: number): boolean {
  if (price <= 0 || price > 0.25) return false;
  const r = Math.round(price * 100) / 100;
  return r === 0.1 || r === 0.2;
}

const INVALID_LABEL =
  /^(p\.?\s*c\.?|pc|pdv|šifra|sifra|artikal|tr\.?\s*pak\.?|rb|rbr|nova\s*šifra|ova\s*šifr|horeca|cenovnik)$/i;

export function sanitizePriceListRow(row: PriceListRow): PriceListRow | null {
  const sku = row.sku?.trim() ?? "";
  const name = row.name?.trim() ?? "";
  const category = row.category?.trim() || null;
  const price = row.price;

  if (!sku || sku.length < 2) return null;
  if (!name || name.length < 4) return null;
  if (INVALID_LABEL.test(sku) || INVALID_LABEL.test(name)) return null;
  if (isPdvValueAsPrice(price)) return null;
  if (price < 1) return null;

  if (name === sku) return null;
  if (/^\d{4,7}$/.test(name) && name.length <= 7) return null;
  if (isPackColumn(name)) return null;

  const pdv_percent = row.pdv_percent ?? 20;
  return {
    sku,
    name,
    category,
    price,
    pdv_percent,
    ...(row.sort_order != null ? { sort_order: row.sort_order } : {}),
  };
}

export function sanitizePriceListRows(rows: PriceListRow[]): {
  valid: PriceListRow[];
  skipped: number;
} {
  const valid: PriceListRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const clean = sanitizePriceListRow(row);
    if (clean) valid.push(clean);
    else skipped++;
  }
  return { valid, skipped };
}
