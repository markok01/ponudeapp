import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireStaffOrganization } from "@/lib/org-session";
import { listOrgActivity } from "@/services/org-activity";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireStaffOrganization(request);
    if (isOrgResponse(ctx)) return ctx;
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "40");
    const entries = await listOrgActivity(ctx.organizationId, limit);
    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/org/activity", error);
    return NextResponse.json({ error: "Aktivnost nije učitana" }, { status: 500 });
  }
}
