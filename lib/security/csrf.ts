import type { NextRequest } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF zaštita bez izmene UI: Same-Origin + Sec-Fetch-Site.
 * Kompatibilno sa Vercel i postojećim fetch pozivima iz aplikacije.
 */
export function assertAdminMutationAllowed(request: NextRequest): boolean {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) return true;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }

  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.split(":")[0].toLowerCase() === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host.split(":")[0].toLowerCase() === host;
    } catch {
      return false;
    }
  }

  return false;
}
