/** HoReCa cenovnik — boje i kolone kao u originalnom Silbo Excel-u. */

export const HORECA_BRAND_FILL = "FFB09FC6";
export const HORECA_HEADER_FILL = "FFCCC0DA";
export const HORECA_TITLE_FILL = "FFFFFFFF";

export const HORECA_WIDE_HEADERS = [
  "šifra",
  "ova šifr",
  "artikal",
  "artikal",
  "tr.pak.",
  "p.c.",
  "PDV",
] as const;

export const HORECA_COMPACT_HEADERS = [
  "šifra",
  "ova šifr",
  "artikal",
  "tr.pak.",
  "p.c.",
  "PDV",
] as const;

export type HorecaLayout = "wide" | "compact";

export type HorecaRowKind = "title" | "brand" | "header" | "subbrand" | "product" | "raw";

export interface HorecaExcelRow {
  kind: HorecaRowKind;
  cells: string[];
  layout: HorecaLayout;
}

export function columnCount(layout: HorecaLayout): number {
  return layout === "wide" ? 7 : 6;
}
