import {
  APP_HOME_PATH,
  DEFAULT_POST_LOGIN_PATH,
  isPublicAuthPath,
  isPublicMarketingPath,
} from "@/lib/public-paths";

/** Bezbedan interni path posle prijave (sprečava open redirect i petlju na /login). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return DEFAULT_POST_LOGIN_PATH;

  let path = raw.trim();
  if (!path) return DEFAULT_POST_LOGIN_PATH;

  try {
    if (path.includes("%")) {
      path = decodeURIComponent(path);
    }
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (!path.startsWith("/") || path.startsWith("//")) return DEFAULT_POST_LOGIN_PATH;

  const pathname = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  if (isPublicAuthPath(pathname)) return DEFAULT_POST_LOGIN_PATH;
  if (pathname === "/") return APP_HOME_PATH;
  if (isPublicMarketingPath(pathname)) return DEFAULT_POST_LOGIN_PATH;

  return path;
}
