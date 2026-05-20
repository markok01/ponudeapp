export type Locale = "sr" | "en";

export const LOCALES: { value: Locale; labelKey: "languageSr" | "languageEn" }[] = [
  { value: "sr", labelKey: "languageSr" },
  { value: "en", labelKey: "languageEn" },
];

export const DEFAULT_LOCALE: Locale = "sr";

export function isLocale(value: unknown): value is Locale {
  return value === "sr" || value === "en";
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Svaki ključ iz sr kataloga → string vrednost (za en prevod). */
export type DeepStringMap<T> = T extends object
  ? { [K in keyof T]: DeepStringMap<T[K]> }
  : string;
