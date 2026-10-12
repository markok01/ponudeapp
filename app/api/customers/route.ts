import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { assertBillingAllowsWrites, planGateResponse } from "@/lib/billing";
import { createCustomer, listCustomers } from "@/services/customers";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;
    const search = request.nextUrl.searchParams.get("q") ?? undefined;
    const customers = await listCustomers(ctx.organizationId, search);
    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/customers", error);
    return NextResponse.json({ error: "Greška pri učitavanju kupaca" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;
    await assertBillingAllowsWrites(ctx.organizationId);
    const body = await request.json();
    const customer = await createCustomer(ctx.organizationId, {
      name: String(body.name ?? ""),
      tax_id: body.tax_id,
      address: body.address,
      email: body.email,
      phone: body.phone,
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers", error);
    const gated = planGateResponse(error);
    if (gated) return gated;
    const message = error instanceof Error ? error.message : "Kupac nije sačuvan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
