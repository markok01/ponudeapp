"use client";

import { PublicShell } from "@/components/marketing/public-shell";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function PricingPage() {
  const t = useTranslations();

  return (
    <PublicShell>
      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("marketing.pricingTitle")}</h1>
        <p className="mt-2 mb-10 max-w-2xl text-muted-foreground">
          {t("marketing.pricingSubtitle")}
        </p>
        <PricingGrid />
        <p className="mt-8 text-xs text-muted-foreground">{t("marketing.priceDisclaimer")}</p>
      </section>
    </PublicShell>
  );
}
