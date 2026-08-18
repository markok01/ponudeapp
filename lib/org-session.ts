import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAuthEnabled, SESSION_COOKIE } from "@/lib/auth";
import { isOwnerRole, isStaffRole } from "@/lib/roles";
import { assertAdminMutationAllowed } from "@/lib/security/csrf";
import { isSuperAdmin } from "@/lib/superadmin";
import { getDefaultOrganizationId } from "@/services/organizations";

export type SessionUserWithOrg = {
  id: number;
  email: string;
  name: string;
  role: string;
  organizationId: number;
};

/** Auth isključen → default org. Auth uključen → org iz sesije ili 401. */
export async function requireOrganizationId(
  request: NextRequest,
): Promise<{ organizationId: number; user: SessionUserWithOrg | null } | NextResponse> {
  if (!isAuthEnabled()) {
    const organizationId = await getDefaultOrganizationId();
    return { organizationId, user: null };
  }

  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user?.organizationId) {
    return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
  }

  return {
    organizationId: user.organizationId,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

export function isOrgResponse(
  value: { organizationId: number } | { user: SessionUserWithOrg } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}

/** Upload / settings izmene — samo owner i admin. */
export async function requireStaffOrganization(
  request: NextRequest,
): Promise<{ organizationId: number; user: SessionUserWithOrg | null } | NextResponse> {
  const ctx = await requireOrganizationId(request);
  if (isOrgResponse(ctx)) return ctx;
  if (ctx.user && !isStaffRole(ctx.user.role)) {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }
  return ctx;
}

/** Brisanje organizacije — samo owner. */
export async function requireOwnerOrganization(
  request: NextRequest,
): Promise<{ organizationId: number; user: SessionUserWithOrg | null } | NextResponse> {
  const ctx = await requireOrganizationId(request);
  if (isOrgResponse(ctx)) return ctx;
  if (!ctx.user || !isOwnerRole(ctx.user.role)) {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }
  return ctx;
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type SuperAdminContext = {
  user: SessionUserWithOrg;
};

/** Operator panel — users.role = superadmin ili SUPERADMIN_EMAILS. */
export async function requireSuperAdmin(
  request: NextRequest,
): Promise<SuperAdminContext | NextResponse> {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }
  if (
    MUTATION_METHODS.has(request.method.toUpperCase()) &&
    !assertAdminMutationAllowed(request)
  ) {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}
