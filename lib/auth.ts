import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  isAuthEnabled,
  SESSION_COOKIE,
} from "@/lib/auth-config";
import { getUserById } from "@/services/users";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { parseSessionToken } from "@/lib/session-token";
import {
  isAdminSessionIdleExpired,
  resolveUserSession,
  revokeUserSession,
  touchUserSession,
} from "@/services/user-sessions";

export {
  createSessionToken,
  parseSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session-token";

export {
  clearSessionCookieOptions,
  getSessionMaxAgeSec,
  isAuthEnabled,
  isAuthRequired,
  isLegacyPasswordAuth,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth-config";

/** Legacy APP_PASSWORD check — zadržano za lokalni dev bez users tabele. */
export function verifyAppPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD?.trim();
  if (!expected) return false;

  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * @param sessionToken — iz `request.cookies` u Route Handlerima (pouzdano u Next 16).
 *   Bez argumenta koristi `cookies()` (Server Components).
 */
export async function getSessionUser(
  sessionToken?: string | null,
): Promise<{
  id: number;
  email: string;
  name: string;
  role: string;
} | null> {
  if (!isAuthEnabled()) return null;

  let token = sessionToken;
  if (token === undefined) {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  }
  const payload = parseSessionToken(token);
  if (!payload) return null;

  const user = await getUserById(payload.userId);
  if (!user || !user.active) return null;
  if (payload.sv !== user.session_version) return null;

  if (payload.userId > 0) {
    if (!payload.sid) return null;
    let resolved = await resolveUserSession(payload.sid, payload.userId);
    if (!resolved) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      resolved = await resolveUserSession(payload.sid, payload.userId);
    }
    if (!resolved) {
      console.warn("[auth] session not found in DB", {
        userId: payload.userId,
        sidPrefix: payload.sid.slice(0, 8),
      });
      return null;
    }

    if (user.role === "admin" && (await isAdminSessionIdleExpired(resolved.rowId))) {
      await revokeUserSession(payload.sid);
      await writeSecurityAuditLog({
        requestId: "session-idle",
        eventType: "auth.session.revoked_idle",
        actorUserId: user.id,
        failureReason: "admin_idle_timeout",
      });
      return null;
    }

    await touchUserSession(payload.sid);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function getSessionFromRequest(request: NextRequest): boolean {
  if (!isAuthEnabled()) return true;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token) !== null;
}

export async function getServerSession(): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  const user = await getSessionUser();
  return user !== null;
}
