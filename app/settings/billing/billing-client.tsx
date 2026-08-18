"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { OrgPlan } from "@/services/organizations";

type PaidPlan = "starter" | "pro" | "business";

type BillingStatus = {
  plan: OrgPlan;
  status: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  writeBlocked: boolean;
  blockReason: string | null;
  pdfAllowed: boolean;
  seatLimit: number;
  priceListLimit: number | null;
  hasCustomer: boolean;
  hasSubscription: boolean;
  stripeConfigured: boolean;
  canManage: boolean;
};

const PAID_PLANS: PaidPlan[] = ["starter", "pro", "business"];

export default function BillingPageClient() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/billing/status", { cache: "no-store" });
    if (!res.ok) throw new Error(t("billing.loadFailed"));
    setStatus((await res.json()) as BillingStatus);
  }

  useEffect(() => {
    void load()
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("billing.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") toast.success(t("billing.checkoutSuccess"));
    if (checkout === "canceled") toast.info(t("billing.checkoutCanceled"));
  }, [searchParams, t]);

  async function startCheckout(plan: PaidPlan) {
    setBusy(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; upgraded?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? t("billing.checkoutFailed"));
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      toast.success(t("billing.upgraded"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("billing.checkoutFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? t("billing.portalFailed"));
      if (data.url) window.location.assign(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("billing.portalFailed"));
    } finally {
      setBusy(null);
    }
  }

  const features: Record<PaidPlan, string[]> = {
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

  if (loading) {
    return (
      <DashboardShell title={t("billing.title")} description={t("common.loading")}>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t("billing.title")} description={t("billing.subtitle")}>
      <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("billing.currentPlan")}
            </CardTitle>
            <CardDescription>
              {t(`billing.plan.${status?.plan ?? "trial"}`)}
              {status?.status && status.status !== "active"
                ? ` · ${t(`billing.status.${status.status}`)}`
                : null}
              {status?.plan === "trial" && status.trialDaysLeft != null
                ? ` · ${t("billing.trialDaysLeft", { count: String(status.trialDaysLeft) })}`
                : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            {status?.canManage && status.hasCustomer ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || !status.stripeConfigured}
                onClick={() => void openPortal()}
              >
                {busy === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("billing.manage")}
              </Button>
            ) : null}
            {!status?.stripeConfigured ? (
              <p className="text-sm text-muted-foreground">{t("billing.notConfigured")}</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {PAID_PLANS.map((plan) => {
            const current = status?.plan === plan && !status.writeBlocked;
            return (
              <Card key={plan} className={current ? "border-primary" : undefined}>
                <CardHeader>
                  <CardTitle>{t(`billing.plan.${plan}`)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {features[plan].map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  {status?.canManage ? (
                    <Button
                      type="button"
                      className="w-full"
                      variant={current ? "outline" : "default"}
                      disabled={
                        current ||
                        busy !== null ||
                        !status.stripeConfigured
                      }
                      onClick={() => void startCheckout(plan)}
                    >
                      {busy === plan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {current ? t("billing.current") : t("billing.upgrade")}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("billing.askAdmin")}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
