import { NextRequest, NextResponse } from "next/server";
import { AUTH_CODE_KEYS } from "@/lib/auth-error-codes";
import {
  LOCALE_COOKIE,
  localeCookieOptions,
  parseLocaleCookieValue,
} from "@/lib/i18n/locale-cookie";
import { createTranslator } from "@/lib/i18n/translate";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/types";

export { AUTH_CODE_KEYS, AuthCodedError } from "@/lib/auth-error-codes";

export function getRequestLocale(request: NextRequest): Locale {
  return (
    parseLocaleCookieValue(request.cookies.get(LOCALE_COOKIE)?.value) ??
    DEFAULT_LOCALE
  );
}

export function attachLocaleCookie(response: NextResponse, locale: Locale): NextResponse {
  response.cookies.set(LOCALE_COOKIE, locale, localeCookieOptions());
  return response;
}

export function authError(
  request: NextRequest,
  code: string,
  status: number,
  extra?: {
    reasons?: string[];
    retryAfterSec?: number;
    verifyUrl?: string;
    delivered?: boolean;
  },
): NextResponse {
  const t = createTranslator(getRequestLocale(request));
  const key = AUTH_CODE_KEYS[code] ?? "auth.signInFailed";
  const params =
    extra?.retryAfterSec != null
      ? { seconds: extra.retryAfterSec }
      : undefined;
  const body: Record<string, unknown> = {
    error: t(key, params),
    code,
  };
  if (extra?.reasons?.length) body.reasons = extra.reasons;
  if (extra?.retryAfterSec != null) body.retryAfterSec = extra.retryAfterSec;
  if (extra?.verifyUrl) body.verifyUrl = extra.verifyUrl;
  if (extra?.delivered != null) body.delivered = extra.delivered;
  return NextResponse.json(body, { status });
}

export function authMessage(
  request: NextRequest,
  code: string,
  params?: Record<string, string | number>,
): string {
  const t = createTranslator(getRequestLocale(request));
  const key = AUTH_CODE_KEYS[code] ?? code;
  return t(key, params);
}
