"use client";

import Link from "next/link";
import { FileSpreadsheet, ListChecks, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/marketing/public-shell";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function MarketingPage() {
  const t = useTranslations();

  const benefits = [
    {
      icon: ListChecks,
      title: t("marketing.benefit1Title"),
      body: t("marketing.benefit1Body"),
    },
    {
      icon: FileSpreadsheet,
      title: t("marketing.benefit2Title"),
      body: t("marketing.benefit2Body"),
    },
    {
      icon: ShieldCheck,
      title: t("marketing.benefit3Title"),
      body: t("marketing.benefit3Body"),
    },
  ];

  return (
    <PublicShell>
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <p className="mb-3 text-sm font-medium text-primary">{t("marketing.eyebrow")}</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {t("marketing.heroTitle")}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("marketing.heroSubtitle")}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">{t("marketing.ctaRegister")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">{t("marketing.ctaPricing")}</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("marketing.trialHint")}</p>
      </section>

      <section className="border-t border-border/70 bg-card/30">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {benefits.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/80 bg-card/80 p-5">
              <div className="mb-3 inline-flex rounded-xl bg-accent/80 p-2.5 text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t("marketing.pricingTitle")}</h2>
        <p className="mt-2 mb-8 max-w-2xl text-sm text-muted-foreground">
          {t("marketing.pricingSubtitle")}
        </p>
        <PricingGrid />
      </section>
    </PublicShell>
  );
}
