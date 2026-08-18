import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-next-path";

export const GOOGLE_OAUTH_STATE_COOKIE = "ponudeapp_oauth_g";
export const GOOGLE_PENDING_COOKIE = "ponudeapp_oauth_gp";
export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
export const GOOGLE_COMPLETE_PATH = "/register/complete";

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function isGoogleSignupEnabled(): boolean {
  const raw = process.env.GOOGLE_SIGNUP?.trim()?.toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

function oauthSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET nije podešen");
  return secret;
}

export function googleRedirectUri(request: NextRequest): string {
  return `${request.nextUrl.origin}${GOOGLE_CALLBACK_PATH}`;
}

export function createGoogleOAuthState(input: {
  next: string;
  remember: boolean;
}): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("hex");
  const payload = Buffer.from(
    JSON.stringify({
      nonce,
      next: safeNextPath(input.next),
      remember: input.remember,
    }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  return { state: `${payload}.${sig}`, nonce };
}

export function parseGoogleOAuthState(raw: string | undefined | null): {
  nonce: string;
  next: string;
  remember: boolean;
} | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      nonce?: string;
      next?: string;
      remember?: boolean;
    };
    if (!data.nonce) return null;
    return {
      nonce: data.nonce,
      next: safeNextPath(data.next),
      remember: data.remember !== false,
    };
  } catch {
    return null;
  }
}

export function googleAuthorizeUrl(request: NextRequest, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export async function exchangeGoogleCode(
  request: NextRequest,
  code: string,
): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  const tokenBody = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description || "Google token razmena nije uspela");
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    cache: "no-store",
  });
  const profile = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    given_name?: string;
  };
  if (!userRes.ok || !profile.sub || !profile.email) {
    throw new Error("Google profil nije dostupan");
  }

  const emailVerified =
    profile.email_verified === true || profile.email_verified === "true";

  return {
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    emailVerified,
    name:
      profile.name?.trim() ||
      profile.given_name?.trim() ||
      profile.email.split("@")[0],
  };
}

export function googleStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
}

export function clearGoogleStateCookieOptions() {
  return {
    ...googleStateCookieOptions(),
    maxAge: 0,
  };
}

export interface PendingGoogleSignup {
  sub: string;
  email: string;
  name: string;
  remember: boolean;
  next: string;
}

function signOAuthPayload(data: object): string {
  const payload = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  const sig = createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function readSignedOAuthPayload(raw: string | undefined | null): unknown | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function createPendingGoogleSignup(input: PendingGoogleSignup): string {
  return signOAuthPayload({
    sub: input.sub,
    email: input.email.trim().toLowerCase(),
    name: input.name,
    remember: input.remember !== false,
    next: safeNextPath(input.next),
  });
}

export function parsePendingGoogleSignup(
  raw: string | undefined | null,
): PendingGoogleSignup | null {
  const data = readSignedOAuthPayload(raw) as {
    sub?: string;
    email?: string;
    name?: string;
    remember?: boolean;
    next?: string;
  } | null;
  if (!data?.sub || !data.email) return null;
  return {
    sub: data.sub,
    email: data.email.trim().toLowerCase(),
    name: (data.name ?? "").trim(),
    remember: data.remember !== false,
    next: safeNextPath(data.next),
  };
}
