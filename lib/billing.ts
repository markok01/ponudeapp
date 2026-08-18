import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth-config";
import {
  getPriceListLimit,
  getSeatLimit,
  isPdfConverterAllowed,
} from "@/lib/plan-limits";
import { getOrganizationById } from "@/services/organizations";
import type { Organization, OrgPlan, OrgStatus } from "@/services/organizations";
import { countPriceLists } from "@/services/price-list";

export class BillingRequiredError extends Error {
  readonly code = "billing_required" as const;
  readonly status = 402;
  constructor(message: string) {
    super(message);
    this.name = "BillingRequiredError";
  }
}

export class PlanLimitError extends Error {
  readonly code = "plan_limit" as const;
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export type BillingBlockReason =
  | "canceled"
  | "past_due"
  | "trial_expired"
  | "suspended";

export type BillingSnapshot = {
  plan: OrgPlan;
  status: OrgStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  writeBlocked: boolean;
  blockReason: BillingBlockReason | null;
  pdfAllowed: boolean;
  seatLimit: number;
  priceListLimit: number | null;
  hasCustomer: boolean;
  hasSubscription: boolean;
};

function parseUtc(value: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZ = /Z$|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const d = new Date(withZ);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function trialDaysRemaining(org: Organization, now = new Date()): number | null {
  const ends = parseUtc(org.trial_ends_at);
  if (!ends) return null;
  const ms = ends.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function isTrialExpired(org: Organization, now = new Date()): boolean {
  const ends = parseUtc(org.trial_ends_at);
  if (!ends) return false;
  return ends.getTime() <= now.getTime();
}

/** Stripe Checkout trial samo ako org trial još traje i nikad nije bilo pretplate. */
export function stripeCheckoutTrialDays(org: Organization, now = new Date()): number | undefined {
  if (org.stripe_subscription_id) return undefined;
  const left = trialDaysRemaining(org, now);
  if (left == null || left <= 0) return undefined;
  return left;
}

export function getBillingBlockReason(
  org: Organization,
  now = new Date(),
): BillingBlockReason | null {
  if (org.status === "suspended") return "suspended";
  if (org.status === "canceled") return "canceled";
  if (org.status === "past_due") return "past_due";
  if (org.plan === "trial" && isTrialExpired(org, now) && !org.stripe_subscription_id) {
    return "trial_expired";
  }
  return null;
}

export function billingMessage(reason: BillingBlockReason): string {
  switch (reason) {
    case "canceled":
      return "Pretplata je otkazana. Nadogradite plan da nastavite sa radom.";
    case "past_due":
      return "Plaćanje pretplate nije uspelo. Ažurirajte karticu da nastavite.";
    case "trial_expired":
      return "Trial je istekao. Izaberite plan da nastavite sa radom.";
    case "suspended":
      return "Organizacija je suspendovana.";
  }
}

export function toBillingSnapshot(org: Organization, now = new Date()): BillingSnapshot {
  const blockReason = getBillingBlockReason(org, now);
  return {
    plan: org.plan,
    status: org.status,
    trialEndsAt: org.trial_ends_at,
    trialDaysLeft: trialDaysRemaining(org, now),
    writeBlocked: Boolean(blockReason),
    blockReason,
    pdfAllowed: isPdfConverterAllowed(org.plan) && !blockReason,
    seatLimit: getSeatLimit(org.plan),
    priceListLimit: getPriceListLimit(org.plan),
    hasCustomer: Boolean(org.stripe_customer_id),
    hasSubscription: Boolean(org.stripe_subscription_id),
  };
}

export async function getOrgBillingSnapshot(
  organizationId: number,
): Promise<BillingSnapshot | null> {
  const org = await getOrganizationById(organizationId);
  if (!org) return null;
  return toBillingSnapshot(org);
}

export async function assertBillingAllowsWrites(organizationId: number): Promise<void> {
  if (!isAuthEnabled()) return;
  const org = await getOrganizationById(organizationId);
  if (!org) throw new BillingRequiredError("Organizacija nije pronađena");
  const reason = getBillingBlockReason(org);
  if (reason === "suspended") {
    throw new BillingRequiredError(billingMessage(reason));
  }
  if (reason) {
    throw new BillingRequiredError(billingMessage(reason));
  }
}

export async function assertPdfConverterPlan(organizationId: number): Promise<void> {
  await assertBillingAllowsWrites(organizationId);
  if (!isAuthEnabled()) return;
  const org = await getOrganizationById(organizationId);
  if (!org) throw new PlanLimitError("Organizacija nije pronađena");
  if (!isPdfConverterAllowed(org.plan)) {
    throw new PlanLimitError(
      "PDF konverter nije uključen na Starter planu. Nadogradite na Pro.",
    );
  }
}

/** Starter/pro: max N nesačuvanih (ne arhiviranih) cenovnika. */
export async function assertCanCreatePriceList(organizationId: number): Promise<void> {
  if (!isAuthEnabled()) return;
  const org = await getOrganizationById(organizationId);
  if (!org) throw new PlanLimitError("Organizacija nije pronađena");
  const limit = getPriceListLimit(org.plan);
  if (limit == null) return;
  const count = await countPriceLists(organizationId);
  if (count >= limit) {
    throw new PlanLimitError(
      `Dostignut limit cenovnika za plan (${limit}). Nadogradite plan ili arhivirajte listu.`,
    );
  }
}

/** @deprecated Koristiti assertCanCreatePriceList — uvoz ide u postojeću listu. */
export async function ensurePriceListCapacity(organizationId: number): Promise<void> {
  await assertCanCreatePriceList(organizationId);
}

export function planGateResponse(error: unknown): NextResponse | null {
  if (error instanceof BillingRequiredError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        redirect: "/settings/billing",
      },
      { status: error.status },
    );
  }
  if (error instanceof PlanLimitError) {
    return NextResponse.json(
      { error: error.message, code: error.code, redirect: "/settings/billing" },
      { status: error.status },
    );
  }
  return null;
}
