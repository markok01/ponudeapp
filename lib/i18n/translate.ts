import type { DeepStringMap, Locale } from "@/lib/i18n/types";
import { messagesEn } from "@/lib/i18n/messages/en";
import { messagesSr } from "@/lib/i18n/messages/sr";

export type Messages = DeepStringMap<typeof messagesSr>;

const catalogs: Record<Locale, Messages> = {
  sr: messagesSr,
  en: messagesEn,
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs.sr;
}

type ParamValue = string | number;

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function createTranslator(locale: Locale) {
  const messages = getMessages(locale);

  return function t(
    key: string,
    params?: Record<string, ParamValue>,
  ): string {
    const raw = getNested(messages as Record<string, unknown>, key);
    if (typeof raw !== "string") return key;

    if (!params) return raw;

    return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
      const val = params[name];
      return val !== undefined ? String(val) : `{${name}}`;
    });
  };
}

export type TranslateFn = ReturnType<typeof createTranslator>;
