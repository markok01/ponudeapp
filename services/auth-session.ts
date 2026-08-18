import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionMaxAgeSec,
  parseSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  generateDeviceId,
  readDeviceIdFromRequest,
} from "@/lib/security/device-id";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { getRequestSecurityMeta } from "@/lib/security/request-context";
import { buildTrustForLogin } from "@/lib/security/session-trust";
import { getSessionClientInfo } from "@/lib/session-client-info";
import { isSuperAdmin } from "@/lib/superadmin";
import { getOrganizationById } from "@/services/organizations";
import {
  createUserSession,
  getValidUserSession,
  revokeUserSession,
} from "@/services/user-sessions";
import type { AppUser } from "@/services/users";

export class OrgSuspendedError extends Error {
  readonly code = "org_suspended" as const;
  constructor() {
    super("Organizacija je suspendovana. Prijava nije moguća.");
    this.name = "OrgSuspendedError";
  }
}

export async function assertOrganizationAllowsLogin(
  organizationId: number,
  actor?: { email: string; role: string },
): Promise<void> {
  const org = await getOrganizationById(organizationId);
  if (!org) {
    throw new OrgSuspendedError();
  }
  if (org.status === "suspended" && !isSuperAdmin(actor ?? {})) {
    throw new OrgSuspendedError();
  }
}

export async function establishUserSession(
  request: NextRequest,
  user: AppUser,
  remember: boolean,
  provider: "password" | "google",
  options?: { redirectTo?: string },
): Promise<NextResponse> {
  if (!user.organization_id) {
    throw new Error("Nalog nije vezan za firmu");
  }
  await assertOrganizationAllowsLogin(user.organization_id, user);

  const org = await getOrganizationById(user.organization_id);
  const redirectTo = org && !org.onboarding_completed
    ? "/onboarding"
    : options?.redirectTo;

  const meta = getRequestSecurityMeta(request);
  const maxAgeSec = getSessionMaxAgeSec(remember);

  const existingToken = request.cookies.get(SESSION_COOKIE)?.value;
  const existing = parseSessionToken(existingToken);
  if (existing?.userId === user.id && existing.sid) {
    await revokeUserSession(existing.sid);
  }

  const clientInfo = await getSessionClientInfo(request);
  const deviceId = readDeviceIdFromRequest(request) ?? generateDeviceId();
  const trust = await buildTrustForLogin({
    userId: user.id,
    deviceId,
    client: clientInfo,
  });

  const sessionId = await createUserSession(user.id, maxAgeSec, clientInfo, {
    deviceId,
    trustScore: trust.trustScore,
    trustLevel: trust.trustLevel,
  });

  const sessionOk = await getValidUserSession(sessionId, user.id);
  if (!sessionOk) {
    throw new Error("session_persist_failed");
  }

  const token = createSessionToken(
    {
      id: user.id,
      email: user.email,
      sessionVersion: user.session_version,
      sessionId,
      organizationId: user.organization_id,
    },
    maxAgeSec,
  );

  await writeSecurityAuditLog({
    requestId: meta.requestId,
    eventType: "auth.login.success",
    action: "auth.login.success",
    actorUserId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      role: user.role,
      provider,
      countryCode: clientInfo.geoCountryCode,
      trustScore: trust.trustScore,
      trustLevel: trust.trustLevel,
      deviceId,
    },
  });

  const response = redirectTo
    ? NextResponse.redirect(new URL(redirectTo, request.url))
    : NextResponse.json({
        ok: true,
        authEnabled: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organization_id,
        },
      });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));
  response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  response.headers.set("x-request-id", meta.requestId);
  return response;
}
