"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMaxLgViewport } from "@/hooks/use-max-lg-viewport";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

type QuoteWorkspaceMetaProps = {
  customerName: string;
  setCustomerName: (v: string) => void;
  customerSuggestions: string[];
  validUntil: string;
  setValidUntil: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  saveLabel: string;
  saveQuote: () => void;
  saving: boolean;
};

export function QuoteWorkspaceMeta({
  customerName,
  setCustomerName,
  customerSuggestions,
  validUntil,
  setValidUntil,
  note,
  setNote,
  saveLabel,
  saveQuote,
  saving,
}: QuoteWorkspaceMetaProps) {
  const t = useTranslations();
  const maxLg = useMaxLgViewport();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (maxLg) setOpen(false);
  }, [maxLg]);

  return (
    <div className="quote-workspace-meta shrink-0 rounded-[var(--radius)] border border-border/80 bg-card px-2 py-2 shadow-[var(--shadow-soft)] sm:px-3 sm:py-3 lg:px-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left lg:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{t("quotes.quoteDetails")}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "grid gap-2 pt-2 sm:gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] lg:items-end lg:gap-4 lg:pt-0",
          !open && "hidden lg:grid",
        )}
      >
        <div className="min-w-0 space-y-1">
          <Label htmlFor="customer" className="text-xs">
            {t("quotes.customerName")}
          </Label>
          <Input
            id="customer"
            list="customer-suggestions"
            placeholder={t("quotes.customerPlaceholder")}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="h-9"
          />
          <datalist id="customer-suggestions">
            {customerSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor="valid-until" className="text-xs">
            {t("quotes.validUntil")}
          </Label>
          <Input
            id="valid-until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="note" className="text-xs">
            {t("quotes.notePdf")}
          </Label>
          <Input
            id="note"
            placeholder={t("quotes.notePlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9"
          />
        </div>
        <Button
          onClick={saveQuote}
          disabled={saving}
          size="lg"
          className="hidden h-9 shrink-0 lg:inline-flex"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
