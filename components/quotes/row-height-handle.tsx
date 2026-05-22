"use client";

import { GripHorizontal } from "lucide-react";
import { usePointerDrag } from "@/hooks/use-pointer-drag";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import { useTranslations } from "@/lib/i18n/locale-provider";

export function RowHeightHandle() {
  const t = useTranslations();
  const { resizeRowHeight } = useQuoteWorkspaceLayout();
  const { onPointerDown } = usePointerDrag("y", resizeRowHeight);

  return (
    <button
      type="button"
      title={t("quotes.resizeRows")}
      aria-label={t("quotes.resizeRows")}
      onPointerDown={onPointerDown}
      className="hidden h-6 cursor-row-resize touch-none items-center gap-0.5 rounded-md border border-border/80 bg-muted/50 px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:inline-flex"
    >
      <GripHorizontal className="h-3.5 w-3.5" />
      <span className="text-[10px] tabular-nums">{t("quotes.rows")}</span>
    </button>
  );
}
