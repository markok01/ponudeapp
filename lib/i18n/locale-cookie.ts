import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/types";

export const LOCALE_COOKIE = "ponudeapp_locale";
export const LOCALE_COOKIE_MAX_AGE = 365 * 86400;

export function parseLocaleCookieValue(
  value: string | null | undefined,
): Locale | null {
  const raw = value?.trim().toLowerCase();
  return isLocale(raw) ? raw : null;
}

export function localeCookieOptions() {
  return {
    httpOnly: false as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
  };
}

export function readLocaleCookieFromDocument(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  return parseLocaleCookieValue(
    match?.[1] ? decodeURIComponent(match[1]) : null,
  );
}

export function writeLocaleCookieOnDocument(locale: Locale): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function fallbackLocale(): Locale {
  return DEFAULT_LOCALE;
}
