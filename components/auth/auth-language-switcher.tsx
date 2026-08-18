"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

/** Jezik na auth / marketing stranicama — radi bez sesije (cookie). */
export function AuthLanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn("flex items-center gap-1 text-xs", className)}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors",
            locale === opt.value
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => void setLocale(opt.value as Locale)}
        >
          {opt.value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
