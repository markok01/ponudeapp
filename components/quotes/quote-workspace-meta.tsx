"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMaxLgViewport } from "@/hooks/use-max-lg-viewport";
import { CurrencySelect } from "@/components/ui/currency-select";
import { InfoHint } from "@/components/ui/info-hint";
import { type Currency } from "@/lib/currency";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

type QuoteWorkspaceMetaProps = {
  customerName: string;
  setCustomerName: (v: string) => void;
  customerId: number | null;
  setCustomerId: (v: number | null) => void;
  customers: Customer[];
  validUntil: string;
  setValidUntil: (v: string) => void;
  currency: Currency;
  setCurrency: (v: Currency) => void;
  note: string;
  setNote: (v: string) => void;
  saveLabel: string;
  saveQuote: () => void;
  saving: boolean;
};

export function QuoteWorkspaceMeta({
  customerName,
  setCustomerName,
  customerId,
  setCustomerId,
  customers,
  validUntil,
  setValidUntil,
  currency,
  setCurrency,
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
    <div className="quote-workspace-meta shrink-0 rounded-[var(--radius)] border border-border bg-card px-2 py-2 sm:px-3 sm:py-3 lg:px-4">
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
          "grid gap-2 pt-2 sm:gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_auto] lg:items-end lg:gap-3 lg:pt-0",
          !open && "hidden lg:grid",
        )}
      >
        <div className="min-w-0 space-y-1">
          <Label htmlFor="customer-pick" className="text-xs">
            {t("customers.pick")}
          </Label>
          <select
            id="customer-pick"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={customerId ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) {
                setCustomerId(null);
                return;
              }
              const picked = customers.find((c) => c.id === Number(raw));
              if (!picked) return;
              setCustomerId(picked.id);
              setCustomerName(picked.name);
            }}
          >
            <option value="">{t("customers.pickNew")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <Label htmlFor="customer" className="text-xs">
            {t("quotes.customerName")}
          </Label>
          <Input
            id="customer"
            placeholder={t("quotes.customerPlaceholder")}
            value={customerName}
            onChange={(e) => {
              const next = e.target.value;
              setCustomerName(next);
              const match = customers.find(
                (c) => c.name.toLowerCase() === next.trim().toLowerCase(),
              );
              setCustomerId(match ? match.id : null);
            }}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="valid-until" className="inline-flex items-center gap-1.5 text-xs">
            {t("quotes.validUntil")}
            <InfoHint text={t("help.validUntil")} label={t("help.aria")} />
          </Label>
          <Input
            id="valid-until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quote-currency" className="inline-flex items-center gap-1.5 text-xs">
            {t("quotes.currency")}
            <InfoHint text={t("help.currency")} label={t("help.aria")} />
          </Label>
          <CurrencySelect
            id="quote-currency"
            value={currency}
            onChange={setCurrency}
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
