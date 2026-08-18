import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireStaffOrganization } from "@/lib/org-session";
import { isStripeConfigured } from "@/lib/stripe";
import { getOrganizationById } from "@/services/organizations";
import { createBillingPortalSession } from "@/services/billing";

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

    const org = await getOrganizationById(ctx.organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organizacija nije pronađena" }, { status: 404 });
    }

    const result = await createBillingPortalSession({
      request,
      org,
      user: ctx.user,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/billing/portal", error);
    const message = error instanceof Error ? error.message : "Portal nije uspeo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
