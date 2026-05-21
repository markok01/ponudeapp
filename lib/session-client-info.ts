import type { NextRequest } from "next/server";

export interface SessionClientInfo {
  deviceLabel: string;
  userAgent: string | null;
  ipAddress: string | null;
  geoCity: string | null;
  geoCountry: string | null;
  geoCountryCode: string | null;
}

const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc00:|fe80:)/i;

function countryNameFromCode(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["sr"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function parseDeviceLabel(userAgent: string): string {
  const ua = userAgent.slice(0, 512);
  if (!ua) return "Nepoznat uređaj";

  let browser = "Pregledač";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  let os = "Uređaj";
  if (/iPad/i.test(ua)) os = "iPad";
  else if (/iPhone|iPod/i.test(ua)) os = "iPhone";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${browser} · ${os}`;
}

export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 45) : null;
}

function geoFromHeaders(request: NextRequest): {
  city: string | null;
  countryCode: string | null;
} {
  const city =
    request.headers.get("x-vercel-ip-city")?.trim() ||
    request.headers.get("cf-ipcity")?.trim() ||
    null;
  const countryCode =
    request.headers.get("x-vercel-ip-country")?.trim() ||
    request.headers.get("cf-ipcountry")?.trim() ||
    null;
  return { city, countryCode: countryCode?.toUpperCase() ?? null };
}

async function geoFromIp(ip: string): Promise<{
  city: string | null;
  countryCode: string | null;
}> {
  if (!ip || PRIVATE_IP.test(ip)) return { city: null, countryCode: null };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timer);
    if (!res.ok) return { city: null, countryCode: null };
    const data = (await res.json()) as {
      status?: string;
      city?: string;
      countryCode?: string;
    };
    if (data.status !== "success") return { city: null, countryCode: null };
    return {
      city: data.city?.trim() || null,
      countryCode: data.countryCode?.trim().toUpperCase() || null,
    };
  } catch {
    return { city: null, countryCode: null };
  }
}

export async function getSessionClientInfo(
  request: NextRequest,
): Promise<SessionClientInfo> {
  const userAgent = request.headers.get("user-agent")?.trim().slice(0, 512) ?? null;
  const deviceLabel = parseDeviceLabel(userAgent ?? "");
  const ipAddress = getClientIp(request);

  let { city, countryCode } = geoFromHeaders(request);
  if (!city && !countryCode && ipAddress) {
    const looked = await geoFromIp(ipAddress);
    city = city ?? looked.city;
    countryCode = countryCode ?? looked.countryCode;
  }

  const geoCountry = countryNameFromCode(countryCode);

  return {
    deviceLabel,
    userAgent,
    ipAddress,
    geoCity: city,
    geoCountry,
    geoCountryCode: countryCode,
  };
}

/** Tekst za admin panel: „Chrome · Windows · Beograd, Srbija” */
export function formatSessionLocation(info: {
  geoCity?: string | null;
  geoCountry?: string | null;
  geoCountryCode?: string | null;
}): string | null {
  const parts: string[] = [];
  if (info.geoCity?.trim()) parts.push(info.geoCity.trim());
  if (info.geoCountry?.trim()) {
    parts.push(info.geoCountry.trim());
  } else if (info.geoCountryCode?.trim()) {
    parts.push(info.geoCountryCode.trim());
  }
  return parts.length > 0 ? parts.join(", ") : null;
}
