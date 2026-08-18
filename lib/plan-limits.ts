import type { OrgPlan } from "@/services/organizations";

export const PAID_PLANS = ["starter", "pro", "business"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

const DEFAULT_SEATS: Record<OrgPlan, number> = {
  trial: 3,
  starter: 3,
  pro: 10,
  business: 25,
};

/** null = unlimited (business). */
const DEFAULT_PRICE_LISTS: Record<OrgPlan, number | null> = {
  trial: 1,
  starter: 1,
  pro: 5,
  business: null,
};

function positiveInt(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return plan === "starter" || plan === "pro" || plan === "business";
}

/** Limit korisnika po planu. SEAT_LIMIT_* ili MAX_USERS (samo trial/starter). */
export function getSeatLimit(plan: OrgPlan): number {
  const planEnv = positiveInt(process.env[`SEAT_LIMIT_${plan.toUpperCase()}`]);
  if (planEnv) return planEnv;

  if (plan === "trial" || plan === "starter") {
    const legacy = positiveInt(process.env.MAX_USERS);
    if (legacy) return legacy;
  }

  return DEFAULT_SEATS[plan];
}

/** Broj nesačuvanih (ne arhiviranih) cenovnika. null = bez limita. */
export function getPriceListLimit(plan: OrgPlan): number | null {
  const planEnv = positiveInt(process.env[`PRICE_LIST_LIMIT_${plan.toUpperCase()}`]);
  if (planEnv) return planEnv;
  return DEFAULT_PRICE_LISTS[plan];
}

/** PDF → Excel: starter ne, trial/pro/business da. */
export function isPdfConverterAllowed(plan: OrgPlan): boolean {
  return plan !== "starter";
}

export function parsePaidPlan(value: unknown): PaidPlan | null {
  if (value === "starter" || value === "pro" || value === "business") return value;
  return null;
}
