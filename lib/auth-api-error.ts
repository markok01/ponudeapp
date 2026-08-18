import { AUTH_CODE_KEYS } from "@/lib/auth-error-codes";
import type { TranslateFn } from "@/lib/i18n/translate";

export type AuthApiErrorPayload = {
  error?: string;
  code?: string;
  reasons?: string[];
  retryAfterSec?: number;
};

export function authApiMessage(
  t: TranslateFn,
  data: AuthApiErrorPayload | null | undefined,
  fallbackKey: string,
): string {
  const payload = data ?? {};
  if (payload.code === "password_policy" && payload.reasons?.length) {
    const mapped = payload.reasons
      .map((reason) => t(`auth.passwordPolicy.${reason}`))
      .filter((text, _, arr) => text && !text.startsWith("auth.passwordPolicy."));
    if (mapped.length) return mapped.join(". ");
  }
  if (payload.code) {
    const key = AUTH_CODE_KEYS[payload.code];
    if (key) {
      const params =
        payload.retryAfterSec != null
          ? { seconds: payload.retryAfterSec }
          : undefined;
      const translated = t(key, params);
      if (translated !== key) return translated;
    }
  }
  return t(fallbackKey);
}
