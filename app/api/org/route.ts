import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth-config";
import { isOrgResponse, requireOwnerOrganization } from "@/lib/org-session";
import { getOrganizationById } from "@/services/organizations";
import { deleteOrganizationAndData } from "@/services/org-delete";

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireOwnerOrganization(request);
    if (isOrgResponse(ctx)) return ctx;
    if (!ctx.user) {
      return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
    }

    const body = (await request.json()) as { confirmName?: string };
    const org = await getOrganizationById(ctx.organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organizacija nije pronađena" }, { status: 404 });
    }

    const typed = String(body.confirmName ?? "").trim();
    if (!typed || typed.toLowerCase() !== org.name.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Naziv firme se ne poklapa" },
        { status: 400 },
      );
    }

    await deleteOrganizationAndData(ctx.organizationId);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
    return res;
  } catch (error) {
    console.error("DELETE /api/org", error);
    const message =
      error instanceof Error ? error.message : "Brisanje nije uspelo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
