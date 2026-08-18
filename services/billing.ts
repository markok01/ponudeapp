import type Stripe from "stripe";
import { execute } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { stripeCheckoutTrialDays } from "@/lib/billing";
import { parsePaidPlan, type PaidPlan } from "@/lib/plan-limits";
import { isStaffRole } from "@/lib/roles";
import {
  getStripe,
  isStripeConfigured,
  planFromStripePriceId,
  requireStripePriceId,
} from "@/lib/stripe";
import {
  getOrganizationById,
  getOrganizationByStripeCustomerId,
  getOrganizationByStripeSubscriptionId,
  updateOrganizationBilling,
  type Organization,
  type OrgStatus,
} from "@/services/organizations";
import type { SessionUserWithOrg } from "@/lib/org-session";
import type { NextRequest } from "next/server";

function stripeObjectId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const anyInv = invoice as Stripe.Invoice & {
    subscription?: string | { id: string } | null;
    parent?: {
      subscription_details?: { subscription?: string | { id: string } | null };
    };
  };
  return (
    stripeObjectId(anyInv.subscription) ??
    stripeObjectId(anyInv.parent?.subscription_details?.subscription)
  );
}

function planFromSubscription(subscription: Stripe.Subscription): PaidPlan | null {
  const priceId = subscription.items.data[0]?.price?.id;
  return planFromStripePriceId(priceId);
}

function statusFromSubscription(subscription: Stripe.Subscription): OrgStatus {
  switch (subscription.status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}

async function findOrgFromStripe(input: {
  organizationId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<Organization | null> {
  const orgId = Number(input.organizationId);
  if (Number.isFinite(orgId) && orgId > 0) {
    const org = await getOrganizationById(orgId);
    if (org) return org;
  }
  if (input.subscriptionId) {
    const org = await getOrganizationByStripeSubscriptionId(input.subscriptionId);
    if (org) return org;
  }
  if (input.customerId) {
    return getOrganizationByStripeCustomerId(input.customerId);
  }
  return null;
}

async function applySubscriptionToOrg(
  org: Organization,
  subscription: Stripe.Subscription,
  customerId?: string | null,
): Promise<void> {
  const plan = planFromSubscription(subscription) ?? org.plan;
  const customer = customerId ?? stripeObjectId(subscription.customer);
  await updateOrganizationBilling(org.id, {
    plan,
    status: statusFromSubscription(subscription),
    stripe_customer_id: customer ?? org.stripe_customer_id,
    stripe_subscription_id: subscription.id,
  });
}

export async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  const result = await execute(
    `INSERT IGNORE INTO stripe_events (id, type) VALUES (?, ?)`,
    [event.id, event.type],
  );
  return result.affectedRows > 0;
}

export async function applyStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;
      const customerId = stripeObjectId(session.customer);
      const subscriptionId = stripeObjectId(session.subscription);
      const org = await findOrgFromStripe({
        organizationId: session.client_reference_id ?? session.metadata?.organizationId,
        customerId,
        subscriptionId,
      });
      if (!org || !subscriptionId) return;
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      await applySubscriptionToOrg(org, subscription, customerId);
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const org = await findOrgFromStripe({
        organizationId: subscription.metadata?.organizationId,
        customerId: stripeObjectId(subscription.customer),
        subscriptionId: subscription.id,
      });
      if (!org) return;
      await applySubscriptionToOrg(org, subscription);
      return;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = stripeObjectId(invoice.customer);
      const subscriptionId = invoiceSubscriptionId(invoice);
      const org = await findOrgFromStripe({ customerId, subscriptionId });
      if (!org) return;
      if (event.type === "invoice.payment_failed") {
        await updateOrganizationBilling(org.id, { status: "past_due" });
        return;
      }
      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await applySubscriptionToOrg(org, subscription, customerId);
      } else {
        await updateOrganizationBilling(org.id, { status: "active" });
      }
    }
  }
}

async function ensureStripeCustomer(
  org: Organization,
  user: SessionUserWithOrg,
): Promise<string> {
  const stripe = getStripe();
  if (org.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(org.stripe_customer_id);
      if (!existing.deleted) return existing.id;
    } catch {
      /* create a new customer */
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: org.name || user.name,
    metadata: { organizationId: String(org.id) },
  });
  await updateOrganizationBilling(org.id, { stripe_customer_id: customer.id });
  return customer.id;
}

export async function createCheckoutOrUpgrade(input: {
  request: NextRequest;
  org: Organization;
  user: SessionUserWithOrg;
  plan: PaidPlan;
}): Promise<{ url?: string; upgraded?: boolean }> {
  if (!isStaffRole(input.user.role)) {
    throw new Error("Samo owner i admin mogu da menjaju pretplatu");
  }
  if (!isStripeConfigured()) {
    throw new Error("Stripe nije podešen");
  }

  const priceId = requireStripePriceId(input.plan);
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(input.org, input.user);

  const existingSubId = input.org.stripe_subscription_id;
  if (existingSubId && input.org.status !== "canceled") {
    try {
      const subscription = await stripe.subscriptions.retrieve(existingSubId);
      if (subscription.status !== "canceled" && subscription.items.data[0]?.id) {
        const currentPrice = subscription.items.data[0].price?.id;
        if (currentPrice === priceId) {
          return { upgraded: true };
        }
        await stripe.subscriptions.update(existingSubId, {
          items: [{ id: subscription.items.data[0].id, price: priceId }],
          proration_behavior: "create_prorations",
          metadata: { organizationId: String(input.org.id) },
        });
        return { upgraded: true };
      }
    } catch {
      /* fall through to Checkout */
    }
  }

  const appUrl = getAppUrl(input.request);
  const trialDays = stripeCheckoutTrialDays(input.org);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: String(input.org.id),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/settings/billing?checkout=canceled`,
    allow_promotion_codes: true,
    metadata: { organizationId: String(input.org.id), plan: input.plan },
    subscription_data: {
      metadata: { organizationId: String(input.org.id), plan: input.plan },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
  });
  if (!session.url) throw new Error("Stripe Checkout URL nije kreiran");
  return { url: session.url };
}

export async function createBillingPortalSession(input: {
  request: NextRequest;
  org: Organization;
  user: SessionUserWithOrg;
}): Promise<{ url: string }> {
  if (!isStaffRole(input.user.role)) {
    throw new Error("Samo owner i admin mogu da upravljaju pretplatom");
  }
  if (!input.org.stripe_customer_id) {
    throw new Error("Nema Stripe pretplate za ovu firmu");
  }
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: input.org.stripe_customer_id,
    return_url: `${getAppUrl(input.request)}/settings/billing`,
  });
  return { url: portal.url };
}

export function parseCheckoutPlan(value: unknown): PaidPlan | null {
  return parsePaidPlan(value);
}
