"use client";

import { BookOpen, ListChecks } from "lucide-react";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type QuoteWorkspaceMobileTab = "catalog" | "quote";

type QuoteWorkspaceMobileTabsProps = {
  active: QuoteWorkspaceMobileTab;
  onChange: (tab: QuoteWorkspaceMobileTab) => void;
  quoteLineCount: number;
};

export function QuoteWorkspaceMobileTabs({
  active,
  onChange,
  quoteLineCount,
}: QuoteWorkspaceMobileTabsProps) {
  const t = useTranslations();

  return (
    <div
      className="quote-workspace-mobile-tabs flex shrink-0 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 lg:hidden"
      role="tablist"
      aria-label={t("quotes.workspaceTabs")}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === "catalog"}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors",
          active === "catalog"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground",
        )}
        onClick={() => onChange("catalog")}
      >
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{t("quotes.catalogTitle")}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "quote"}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors",
          active === "quote"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground",
        )}
        onClick={() => onChange("quote")}
      >
        <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{t("quotes.linesTitle")}</span>
        {quoteLineCount > 0 ? (
          <span className="ml-0.5 shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
            {quoteLineCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
