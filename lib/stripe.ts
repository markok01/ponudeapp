import Stripe from "stripe";
import type { PaidPlan } from "@/lib/plan-limits";

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY nije podešen");
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET nije podešen");
  return secret;
}

const PRICE_ENV: Record<PaidPlan, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  business: "STRIPE_PRICE_BUSINESS",
};

export function getStripePriceId(plan: PaidPlan): string | null {
  const id = process.env[PRICE_ENV[plan]]?.trim();
  return id || null;
}

export function planFromStripePriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PRICE_ENV) as PaidPlan[]) {
    if (getStripePriceId(plan) === priceId) return plan;
  }
  return null;
}

export function requireStripePriceId(plan: PaidPlan): string {
  const id = getStripePriceId(plan);
  if (!id) {
    throw new Error(`Cena za plan ${plan} nije podešena (${PRICE_ENV[plan]})`);
  }
  return id;
}
