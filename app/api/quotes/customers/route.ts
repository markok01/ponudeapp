import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { listCustomerNames } from "@/services/quotes";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const customers = await listCustomerNames(ctx.organizationId);
    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/quotes/customers", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju kupaca" },
      { status: 500 },
    );
  }
}
