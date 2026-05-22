/** Bezbedan interni path posle prijave (sprečava open redirect i petlju na /login). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";

  let path = raw.trim();
  if (!path) return "/";

  try {
    if (path.includes("%")) {
      path = decodeURIComponent(path);
    }
  } catch {
    return "/";
  }

  if (!path.startsWith("/") || path.startsWith("//")) return "/";

  const pathname = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  if (pathname === "/login" || pathname.startsWith("/login/")) return "/";

  return path;
}
