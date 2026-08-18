"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Label } from "@/components/ui/label";
import { fetchAppSettings, persistAppSettings } from "@/lib/app-settings";
import { defaultCurrencyForLocale, normalizeCurrency, type Currency } from "@/lib/currency";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useEffect, useState } from "react";

export function CurrencySettingsCard() {
  const { locale, t } = useLocale();
  const [currency, setCurrency] = useState<Currency>(defaultCurrencyForLocale(locale));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void fetchAppSettings().then((settings) => {
      setCurrency(normalizeCurrency(settings.currency));
      setReady(true);
    });
  }, []);

  async function onChange(next: Currency) {
    setCurrency(next);
    await persistAppSettings({ currency: next });
    toast.success(t("settings.currencySaved"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.currency")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("settings.currencyHelp")}</p>
        <Label htmlFor="app-currency">{t("settings.currency")}</Label>
        <CurrencySelect
          id="app-currency"
          value={currency}
          onChange={(v) => void onChange(v)}
          className="sm:max-w-xs"
        />
        {!ready ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
