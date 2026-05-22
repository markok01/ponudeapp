import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { assertAdminMutationAllowed } from "@/lib/security/csrf";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import {
  getRequestSecurityMeta,
  type RequestSecurityMeta,
} from "@/lib/security/request-context";
import {
  evaluateAdminActionSuspicious,
  recordSuspiciousAlert,
} from "@/lib/security/suspicious";
import {
  assertTrustForSensitiveAction,
  ReauthRequiredError,
} from "@/lib/security/trust-guard";
import { resolveUserSession } from "@/services/user-sessions";

export interface AdminApiContext {
  session: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
  meta: RequestSecurityMeta;
}

type AdminHandler = (ctx: AdminApiContext) => Promise<NextResponse>;

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function assertSensitiveTrust(
  request: NextRequest,
  userId: number,
): Promise<void> {
  const sid = parseSessionToken(request.cookies.get(SESSION_COOKIE)?.value)?.sid;
  if (!sid) throw new ReauthRequiredError();
  const resolved = await resolveUserSession(sid, userId);
  if (!resolved) throw new ReauthRequiredError();
  assertTrustForSensitiveAction(resolved.trustLevel);
}

export async function withAdminApi(
  request: NextRequest,
  handler: AdminHandler,
  options?: { sensitive?: boolean },
): Promise<NextResponse> {
  const meta = getRequestSecurityMeta(request);
  const session = await getSessionUser(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (!session || session.role !== "admin") {
    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "admin.api.forbidden",
      action: "admin.api.forbidden",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      failureReason: "not_admin_or_no_session",
      metadata: { path: request.nextUrl.pathname, method: request.method },
    });
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }

  if (!assertAdminMutationAllowed(request)) {
    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "admin.api.csrf_blocked",
      action: "admin.api.csrf_blocked",
      actorUserId: session.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      failureReason: "csrf_origin_check",
      metadata: { path: request.nextUrl.pathname, method: request.method },
    });
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }

  const sid = parseSessionToken(request.cookies.get(SESSION_COOKIE)?.value)?.sid;
  const resolved = sid ? await resolveUserSession(sid, session.id) : null;

  const suspicious = await evaluateAdminActionSuspicious({
    requestId: meta.requestId,
    adminUserId: session.id,
    deviceId: resolved?.deviceId ?? null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    pathname: request.nextUrl.pathname,
    method: request.method,
  });
  if (suspicious.alert) {
    await recordSuspiciousAlert({
      requestId: meta.requestId,
      actorUserId: session.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      reasons: suspicious.reasons,
      context: { path: request.nextUrl.pathname, method: request.method },
    });
  }

  const isMutation = MUTATION_METHODS.has(request.method.toUpperCase());
  const needsTrust =
    options?.sensitive ?? (isMutation && request.method !== "GET");

  if (needsTrust) {
    try {
      await assertSensitiveTrust(request, session.id);
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 403 },
        );
      }
      throw error;
    }
  }

  if (request.method === "GET") {
    await writeSecurityAuditLog({
      requestId: meta.requestId,
      eventType: "admin.api.access",
      action: "admin.api.access",
      actorUserId: session.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { path: request.nextUrl.pathname, method: "GET" },
    });
  }

  return handler({ session, meta });
}
