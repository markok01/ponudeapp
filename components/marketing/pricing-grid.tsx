"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencySelect } from "@/components/ui/currency-select";
import {
  defaultCurrencyForLocale,
  PLAN_PRICES,
  type Currency,
} from "@/lib/currency";
import { useLocale, useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

const PLANS = ["starter", "pro", "business"] as const;

export function PricingGrid({ highlight = "pro" }: { highlight?: (typeof PLANS)[number] }) {
  const t = useTranslations();
  const { locale } = useLocale();
  const [currency, setCurrency] = useState<Currency>(() =>
    defaultCurrencyForLocale(locale),
  );

  useEffect(() => {
    setCurrency(defaultCurrencyForLocale(locale));
  }, [locale]);

  const features: Record<(typeof PLANS)[number], string[]> = {
    starter: [
      t("billing.featureLists", { count: "1" }),
      t("billing.featureSeats", { count: "3" }),
      t("billing.featureNoPdf"),
    ],
    pro: [
      t("billing.featureLists", { count: "5" }),
      t("billing.featureSeats", { count: "10" }),
      t("billing.featurePdf"),
    ],
    business: [
      t("billing.featureListsUnlimited"),
      t("billing.featureSeats", { count: "25" }),
      t("billing.featurePdf"),
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <label htmlFor="marketing-currency" className="text-sm text-muted-foreground">
          {t("marketing.currency")}
        </label>
        <CurrencySelect
          id="marketing-currency"
          value={currency}
          onChange={setCurrency}
          className="h-9 sm:w-52"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan === highlight;
          return (
            <Card
              key={plan}
              className={cn(
                "flex flex-col",
                featured && "border-primary/40 shadow-[0_16px_40px_rgba(91,141,239,0.12)]",
              )}
            >
              <CardHeader>
                {featured ? (
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
                    {t("marketing.popular")}
                  </p>
                ) : null}
                <CardTitle>{t(`billing.plan.${plan}`)}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-semibold text-foreground">
                    {formatCurrency(PLAN_PRICES[plan][currency], currency)}
                  </span>
                  <span className="ml-1 text-muted-foreground">{t("marketing.perMonth")}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {features[plan].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-auto w-full" variant={featured ? "default" : "outline"}>
                  <Link href="/register">{t("marketing.ctaStartTrial")}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
