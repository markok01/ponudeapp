"use client";

import { CreditCard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n/locale-provider";

type BillingStatus = {
  writeBlocked?: boolean;
  blockReason?: string | null;
};

export function BillingBanner() {
  const t = useTranslations();
  const pathname = usePathname();
  const [blocked, setBlocked] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BillingStatus | null) => {
        if (cancelled || !data) return;
        setBlocked(Boolean(data.writeBlocked));
        setReason(data.blockReason ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!blocked || pathname.startsWith("/settings/billing")) return null;

  const message =
    reason === "past_due"
      ? t("billing.pastDue")
      : reason === "canceled"
        ? t("billing.canceled")
        : t("billing.trialExpired");

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
        {message}
      </p>
      <Link
        href="/settings/billing"
        className="shrink-0 font-medium underline underline-offset-2"
      >
        {t("billing.goToBilling")}
      </Link>
    </div>
  );
}
