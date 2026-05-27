import { createHmac, timingSafeEqual } from "crypto";
import { getSessionMaxAgeSec } from "@/lib/auth-config";

const TOKEN_VERSION = 5;
const TOKEN_VERSION_LEGACY = 4;

export interface SessionPayload {
  v: number;
  userId: number;
  /** Samo JWT v4 (legacy tok) */
  email?: string;
  /** Opaque session token iz user_sessions (64 hex) */
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

/** Edge/proxy-safe — bez baze. */
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
  return parseSessionToken(token) !== null;
}
