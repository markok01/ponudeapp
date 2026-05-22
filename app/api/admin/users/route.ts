import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { withAdminApi } from "@/lib/security/admin-api";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import {
  checkRateLimit,
  getAdminCreateUserRateLimitConfig,
  recordRateLimitFailure,
} from "@/lib/security/rate-limit";
import { assertAdminCreateUserCooldown } from "@/services/user-sessions";
import { createUser, deactivateUser, deleteUser, listUsers } from "@/services/users";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const users = await listUsers();
    return NextResponse.json(
      users.map(({ id, email, name, role, active, created_at }) => ({
        id,
        email,
        name,
        role,
        active,
        created_at,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withAdminApi(
    request,
    async ({ session, meta }) => {
    const limitKey = `admin:${session.id}`;
    const limit = await checkRateLimit(
      "admin_create_user",
      limitKey,
      getAdminCreateUserRateLimitConfig(),
    );
    if (!limit.allowed) {
      await writeSecurityAuditLog({
        requestId: meta.requestId,
        eventType: "admin.api.forbidden",
        actorUserId: session.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        failureReason: "create_user_rate_limit",
      });
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
          "admin_create_user",
          limitKey,
          getAdminCreateUserRateLimitConfig(),
        );
        return NextResponse.json({ error: message }, { status: 429 });
      }
    }

    try {
      const body = await request.json();
      if (body.website || body._hp || body.url) {
        await writeSecurityAuditLog({
          requestId: meta.requestId,
          eventType: "admin.suspicious",
          actorUserId: session.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          failureReason: "honeypot_triggered",
        });
        return NextResponse.json({ error: "Nedozvoljeno" }, { status: 400 });
      }

      const user = await createUser({
        email: body.email,
        password: body.password,
        name: body.name,
        role: "user",
        strictPassword: true,
      });

      await writeSecurityAuditLog({
        requestId: meta.requestId,
        eventType: "admin.user.created",
        actorUserId: session.id,
        targetUserId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { role: user.role },
      });

      return NextResponse.json(user, { status: 201 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kreiranje naloga nije uspelo";
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
    const permanent = request.nextUrl.searchParams.get("permanent") === "1";
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    if (id === session.id) {
      return NextResponse.json(
        {
          error: permanent
            ? "Ne možete obrisati sopstveni nalog"
            : "Ne možete deaktivirati sopstveni nalog",
        },
        { status: 400 },
      );
    }

    try {
      if (permanent) {
        await deleteUser(id);
        await writeSecurityAuditLog({
          requestId: meta.requestId,
          eventType: "admin.user.deleted",
          actorUserId: session.id,
          targetUserId: id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
        return NextResponse.json({ message: "Nalog uklonjen" });
      }
      await deactivateUser(id);
      await writeSecurityAuditLog({
        requestId: meta.requestId,
        eventType: "admin.user.deactivated",
        actorUserId: session.id,
        targetUserId: id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return NextResponse.json({ message: "Nalog deaktiviran" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Operacija nije uspela";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    },
    { sensitive: true },
  );
}
