import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  getSessionMaxAgeSec,
  isAuthEnabled,
  SESSION_COOKIE,
  sessionCookieOptions,
  clearSessionCookieOptions,
} from "@/lib/auth-config";
import { getUserById } from "@/services/users";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { isAdminIdleExpired } from "@/lib/security/admin-idle";
import {
  resolveUserSession,
  revokeUserSession,
  touchUserSession,
} from "@/services/user-sessions";

export {
  clearSessionCookieOptions,
  getSessionMaxAgeSec,
  isAuthEnabled,
  isAuthRequired,
  isLegacyPasswordAuth,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth-config";

const TOKEN_VERSION = 5;
const TOKEN_VERSION_LEGACY = 4;

export interface SessionPayload {
  v: number;
  userId: number;
  /** Samo JWT v4 (legacy tok) */
  email?: string;
  /** ID sesije u user_sessions (jedan uređaj/pregledač) */
  sid?: string;
  /** Brojač sesije — povećava se pri deaktivaciji */
  sv: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET nije podešen");
  }
  return secret;
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(
  user: {
    id: number;
    email: string;
    sessionVersion?: number;
    sessionId?: string;
  },
  maxAgeSec = getSessionMaxAgeSec(true),
): string {
  const payload: SessionPayload = {
    v: TOKEN_VERSION,
    userId: user.id,
    ...(user.sessionId ? { sid: user.sessionId } : {}),
    sv: user.sessionVersion ?? 1,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

export function parseSessionToken(
  token: string | undefined | null,
): SessionPayload | null {
  if (!token) return null;

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = signPayload(payloadB64);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as SessionPayload;

    const versionOk =
      payload.v === TOKEN_VERSION || payload.v === TOKEN_VERSION_LEGACY;
    if (!versionOk || !payload.userId || typeof payload.sv !== "number") {
      return null;
    }
    if (payload.v === TOKEN_VERSION_LEGACY && !payload.email) {
      return null;
    }
    if (payload.userId > 0 && !payload.sid) {
      return null;
    }
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!isAuthEnabled()) return true;
  return parseSessionToken(token) !== null;
}

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
    const resolved = await resolveUserSession(payload.sid, payload.userId);
    if (!resolved) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[auth] session not found in DB", {
          userId: payload.userId,
          sidPrefix: payload.sid.slice(0, 8),
        });
      }
      return null;
    }

    if (
      user.role === "admin" &&
      isAdminIdleExpired(resolved.lastActivityAt, resolved.sessionCreatedAt)
    ) {
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
  return verifySessionToken(token);
}

export async function getServerSession(): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  const user = await getSessionUser();
  return user !== null;
}
