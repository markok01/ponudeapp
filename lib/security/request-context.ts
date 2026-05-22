import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/session-client-info";

export interface RequestSecurityMeta {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export function getRequestId(request: NextRequest): string {
  const incoming =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-vercel-id")?.trim();
  if (incoming && incoming.length <= 64) return incoming.slice(0, 64);
  return randomUUID();
}

export function getRequestSecurityMeta(request: NextRequest): RequestSecurityMeta {
  return {
    requestId: getRequestId(request),
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent")?.trim().slice(0, 512) ?? null,
  };
}
