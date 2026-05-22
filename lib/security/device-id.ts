import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";

export const DEVICE_COOKIE = "ponudeapp_device";

const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateDeviceId(): string {
  return randomUUID();
}

export function normalizeDeviceId(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v || !DEVICE_ID_RE.test(v)) return null;
  return v.toLowerCase();
}

export function readDeviceIdFromRequest(request: NextRequest): string | null {
  return normalizeDeviceId(request.cookies.get(DEVICE_COOKIE)?.value);
}

export function deviceCookieOptions(maxAgeSec = 365 * 86400) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
