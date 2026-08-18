"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchAppSettings,
  persistAppSettings,
  saveAppSettingsLocal,
} from "@/lib/app-settings";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translate";
import {
  readLocaleCookieFromDocument,
  writeLocaleCookieOnDocument,
} from "@/lib/i18n/locale-cookie";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/types";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: TranslateFn;
  ready: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromCookie = readLocaleCookieFromDocument();
    if (fromCookie) setLocaleState(fromCookie);

    let cancelled = false;
    void fetchAppSettings().then((settings) => {
      if (cancelled) return;
      const cookie = readLocaleCookieFromDocument();
      if (cookie) {
        setLocaleState(cookie);
        saveAppSettingsLocal({ locale: cookie });
        if (normalizeLocale(settings.locale) !== cookie) {
          void persistAppSettings({ locale: cookie });
        }
      } else {
        const next = normalizeLocale(settings.locale);
        setLocaleState(next);
        writeLocaleCookieOnDocument(next);
        saveAppSettingsLocal({ locale: next });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    writeLocaleCookieOnDocument(next);
    saveAppSettingsLocal({ locale: next });
    await persistAppSettings({ locale: next });
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useTranslations() {
  return useLocale().t;
}
