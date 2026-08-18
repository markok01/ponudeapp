import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireSuperAdmin } from "@/lib/org-session";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { getRequestSecurityMeta } from "@/lib/security/request-context";
import {
  getOrganizationById,
  updateOrganizationBilling,
  type OrgStatus,
} from "@/services/organizations";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSuperAdmin(request);
  if (isOrgResponse(ctx)) return ctx;

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Neispravan id" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Neispravan JSON" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "suspended" && status !== "active") {
    return NextResponse.json({ error: "status mora biti active ili suspended" }, { status: 400 });
  }

  const org = await getOrganizationById(id);
  if (!org) {
    return NextResponse.json({ error: "Organizacija nije pronađena" }, { status: 404 });
  }

  const nextStatus: OrgStatus = status;
  await updateOrganizationBilling(id, { status: nextStatus });

  const meta = getRequestSecurityMeta(request);
  await writeSecurityAuditLog({
    requestId: meta.requestId,
    eventType:
      nextStatus === "suspended" ? "ops.org.suspended" : "ops.org.activated",
    action: nextStatus === "suspended" ? "ops.org.suspended" : "ops.org.activated",
    actorUserId: ctx.user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { organizationId: id, status: nextStatus },
  });

  const updated = await getOrganizationById(id);
  return NextResponse.json({ ok: true, organization: updated });
}
