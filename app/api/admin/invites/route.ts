import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { withAdminApi } from "@/lib/security/admin-api";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import {
  checkRateLimit,
  getAdminCreateUserRateLimitConfig,
  recordRateLimitFailure,
} from "@/lib/security/rate-limit";
import { isInviteRole } from "@/lib/roles";
import { assertAdminCreateUserCooldown } from "@/services/user-sessions";
import {
  createOrgInvite,
  listPendingInvites,
  revokeOrgInvite,
} from "@/services/org-invites";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async ({ session }) => {
    const invites = await listPendingInvites(session.organizationId);
    return NextResponse.json(invites);
  });
}

export async function POST(request: NextRequest) {
  return withAdminApi(
    request,
    async ({ session, meta }) => {
      const limitKey = `admin:${session.id}`;
      const limit = await checkRateLimit(
        "admin_invite",
        limitKey,
        getAdminCreateUserRateLimitConfig(),
      );
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Previše zahteva. Pokušajte kasnije." },
          { status: 429 },
        );
      }

      const payloadSid = parseSessionToken(
        request.cookies.get(SESSION_COOKIE)?.value,
      )?.sid;
      if (payloadSid) {
        try {
          await assertAdminCreateUserCooldown(payloadSid, session.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Cooldown aktivan";
          await recordRateLimitFailure(
            "admin_invite",
            limitKey,
            getAdminCreateUserRateLimitConfig(),
          );
          return NextResponse.json({ error: message }, { status: 429 });
        }
      }

      try {
        const body = await request.json();
        if (body.website || body._hp || body.url) {
          return NextResponse.json({ error: "Nedozvoljeno" }, { status: 400 });
        }

        const role = body.role;
        if (!isInviteRole(role)) {
          return NextResponse.json(
            { error: "Uloga mora biti admin ili user" },
            { status: 400 },
          );
        }

        const result = await createOrgInvite({
          organizationId: session.organizationId,
          email: String(body.email ?? ""),
          name: body.name ? String(body.name) : undefined,
          role,
          invitedBy: session.id,
          request,
        });

        await writeSecurityAuditLog({
          requestId: meta.requestId,
          eventType: "admin.invite.created",
          actorUserId: session.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: { email: result.invite.email, role: result.invite.role },
        });

        return NextResponse.json(
          {
            ...result.invite,
            delivered: result.delivered,
            logged: result.logged,
          },
          { status: 201 },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Slanje poziva nije uspelo";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    },
    { sensitive: true },
  );
}

export async function DELETE(request: NextRequest) {
  return withAdminApi(
    request,
    async ({ session, meta }) => {
      const id = Number(request.nextUrl.searchParams.get("id"));
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
      }
      try {
        await revokeOrgInvite(id, session.organizationId);
        await writeSecurityAuditLog({
          requestId: meta.requestId,
          eventType: "admin.invite.revoked",
          actorUserId: session.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: { inviteId: id },
        });
        return NextResponse.json({ ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Brisanje poziva nije uspelo";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    },
    { sensitive: true },
  );
}
