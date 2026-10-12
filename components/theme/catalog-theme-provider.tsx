"use client";

import { useEffect } from "react";
import {
  applyCatalogThemeToDocument,
  resolveCatalogThemeFromSettings,
} from "@/lib/catalog-theme";
import { fetchAppSettings } from "@/lib/app-settings";

/** Učitava sačuvanu temu cenovnika i postavlja CSS promenljive. */
export function CatalogThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    void fetchAppSettings().then((settings) => {
      if (cancelled) return;
      applyCatalogThemeToDocument(resolveCatalogThemeFromSettings(settings));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
