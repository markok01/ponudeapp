import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireStaffOrganization } from "@/lib/org-session";
import { isStripeConfigured } from "@/lib/stripe";
import { getOrganizationById } from "@/services/organizations";
import { createCheckoutOrUpgrade, parseCheckoutPlan } from "@/services/billing";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireStaffOrganization(request);
    if (isOrgResponse(ctx)) return ctx;
    if (!ctx.user) {
      return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe nije podešen" }, { status: 503 });
    }

    const body = (await request.json()) as { plan?: string };
    const plan = parseCheckoutPlan(body.plan);
    if (!plan) {
      return NextResponse.json({ error: "Nepoznat plan" }, { status: 400 });
    }

    const org = await getOrganizationById(ctx.organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organizacija nije pronađena" }, { status: 404 });
    }

    const result = await createCheckoutOrUpgrade({
      request,
      org,
      user: ctx.user,
      plan,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/billing/checkout", error);
    const message = error instanceof Error ? error.message : "Checkout nije uspeo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
