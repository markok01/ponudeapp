"use client";

import { Columns3, Eye, EyeOff, Type } from "lucide-react";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import type { CatalogMobileToggleKey } from "@/lib/quote-catalog-mobile-prefs";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

const TOGGLE_KEYS: CatalogMobileToggleKey[] = ["sku", "price", "pdv"];

export function CatalogMobileToolbar() {
  const t = useTranslations();
  const {
    isCompactCatalog,
    catalogMobilePrefs,
    toggleCatalogMobileColumn,
    setCatalogMobileFocusName,
  } = useQuoteWorkspaceLayout();

  if (!isCompactCatalog) return null;

  const { hidden, focusName } = catalogMobilePrefs;

  return (
    <div
      className="catalog-mobile-toolbar shrink-0 border-b border-border/60 bg-muted/25 px-2 py-2 max-lg:block lg:hidden"
      role="toolbar"
      aria-label={t("catalog.mobileColumnsToolbar")}
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        <Columns3 className="h-3 w-3 shrink-0" aria-hidden />
        {t("catalog.mobileColumnsLabel")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCatalogMobileFocusName(!focusName)}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all duration-200",
            focusName
              ? "border-primary bg-primary/15 text-primary shadow-sm"
              : "border-border bg-card text-foreground active:scale-[0.98]",
          )}
          aria-pressed={focusName}
        >
          <Type className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("catalog.mobileFocusName")}
        </button>
        {TOGGLE_KEYS.map((key) => {
          const isHidden = hidden.includes(key) || (focusName && (key === "sku" || key === "pdv"));
          const label =
            key === "sku"
              ? t("catalog.sku")
              : key === "price"
                ? t("catalog.unitPrice")
                : t("catalog.vat");
          return (
            <button
              key={key}
              type="button"
              disabled={focusName && (key === "sku" || key === "pdv")}
              onClick={() => toggleCatalogMobileColumn(key)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-all duration-200",
                isHidden
                  ? "border-border/80 bg-muted/40 text-muted-foreground"
                  : "border-primary/35 bg-card text-foreground shadow-sm active:scale-[0.98]",
                focusName && (key === "sku" || key === "pdv") && "opacity-40",
              )}
              aria-pressed={!isHidden}
            >
              {isHidden ? (
                <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[0.625rem] leading-snug text-muted-foreground">
        {t("catalog.mobileResizeHint")}
      </p>
    </div>
  );
}
