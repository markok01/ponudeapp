import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireStaffOrganization } from "@/lib/org-session";
import {
  getOrganizationById,
  setOnboardingCompleted,
  updateOrganizationName,
} from "@/services/organizations";
import { saveAppSettingsToDb } from "@/services/app-settings";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireStaffOrganization(request);
    if (isOrgResponse(ctx)) return ctx;

    const body = (await request.json()) as { companyName?: string; complete?: boolean };
    if (body.companyName != null) {
      const name = String(body.companyName).trim();
      if (name) {
        await updateOrganizationName(ctx.organizationId, name);
        await saveAppSettingsToDb(ctx.organizationId, { companyName: name });
      }
    }
    if (body.complete !== false) {
      await setOnboardingCompleted(ctx.organizationId, true);
    }

    const org = await getOrganizationById(ctx.organizationId);
    return NextResponse.json({
      ok: true,
      onboardingCompleted: org?.onboarding_completed ?? true,
      name: org?.name ?? "",
    });
  } catch (error) {
    console.error("POST /api/org/onboarding", error);
    const message =
      error instanceof Error ? error.message : "Onboarding nije sačuvan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
