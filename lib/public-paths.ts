/** Javne auth rute — proxy i SessionGuard moraju da ih tretiraju isto. */
export const PUBLIC_AUTH_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/invite",
] as const;

/** Marketing i pravne stranice — tačno `/`, ne prefiks (inače bi sve bilo javno). */
export const PUBLIC_MARKETING_PATHS = ["/", "/pricing"] as const;

export const DEFAULT_POST_LOGIN_PATH = "/products";
export const APP_HOME_PATH = "/app";

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isPublicMarketingPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/pricing") return true;
  if (pathname === "/legal" || pathname.startsWith("/legal/")) return true;
  return false;
}

export function isPublicPath(pathname: string): boolean {
  return isPublicAuthPath(pathname) || isPublicMarketingPath(pathname);
}
