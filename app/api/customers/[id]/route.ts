import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { assertBillingAllowsWrites, planGateResponse } from "@/lib/billing";
import { deleteCustomer, updateCustomer } from "@/services/customers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;
    await assertBillingAllowsWrites(ctx.organizationId);
    const { id } = await context.params;
    const customerId = Number(id);
    if (!Number.isFinite(customerId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }
    const body = await request.json();
    const customer = await updateCustomer(ctx.organizationId, customerId, {
      name: String(body.name ?? ""),
      tax_id: body.tax_id,
      address: body.address,
      email: body.email,
      phone: body.phone,
    });
    return NextResponse.json(customer);
  } catch (error) {
    console.error("PATCH /api/customers/[id]", error);
    const gated = planGateResponse(error);
    if (gated) return gated;
    const message = error instanceof Error ? error.message : "Kupac nije sačuvan";
    const status = message.includes("nije pronađen") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;
    await assertBillingAllowsWrites(ctx.organizationId);
    const { id } = await context.params;
    const customerId = Number(id);
    if (!Number.isFinite(customerId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }
    await deleteCustomer(ctx.organizationId, customerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id]", error);
    const gated = planGateResponse(error);
    if (gated) return gated;
    const message = error instanceof Error ? error.message : "Kupac nije obrisan";
    const status = message.includes("nije pronađen") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
