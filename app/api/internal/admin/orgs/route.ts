import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireSuperAdmin } from "@/lib/org-session";
import { listOrganizationsForAdmin } from "@/services/organizations";

export async function GET(request: NextRequest) {
  const ctx = await requireSuperAdmin(request);
  if (isOrgResponse(ctx)) return ctx;

  try {
    const orgs = await listOrganizationsForAdmin();
    return NextResponse.json({ orgs });
  } catch (error) {
    console.error("GET /api/internal/admin/orgs", error);
    return NextResponse.json({ error: "Lista nije učitana" }, { status: 500 });
  }
}
