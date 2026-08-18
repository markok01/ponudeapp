import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { toBillingSnapshot } from "@/lib/billing";
import { isStaffRole } from "@/lib/roles";
import { isStripeConfigured } from "@/lib/stripe";
import { getOrganizationById } from "@/services/organizations";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const org = await getOrganizationById(ctx.organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organizacija nije pronađena" }, { status: 404 });
    }

    const billing = toBillingSnapshot(org);
    return NextResponse.json({
      ...billing,
      stripeConfigured: isStripeConfigured(),
      canManage: Boolean(ctx.user && isStaffRole(ctx.user.role)),
    });
  } catch (error) {
    console.error("GET /api/billing/status", error);
    return NextResponse.json({ error: "Greška pri učitavanju pretplate" }, { status: 500 });
  }
}
