"use client";

import { CURRENCIES, normalizeCurrency, type Currency } from "@/lib/currency";
import { useTranslations } from "@/lib/i18n/locale-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function CurrencySelect({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: Currency;
  onChange: (currency: Currency) => void;
  className?: string;
}) {
  const t = useTranslations();

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(normalizeCurrency(next))}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((code) => (
          <SelectItem key={code} value={code}>
            {t(`currency.${code}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
