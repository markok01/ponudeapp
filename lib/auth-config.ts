/** Edge/proxy-safe auth konfiguracija — bez Node crypto ili baze. */

export const SESSION_COOKIE = "ponudeapp_session";

const DEFAULT_SESSION_DAYS = 7;
const DEFAULT_REMEMBER_DAYS = 365;

export function getSessionMaxAgeSec(remember = true): number {
  if (remember) {
    const raw = process.env.SESSION_REMEMBER_DAYS?.trim();
    const days = raw ? Number(raw) : DEFAULT_REMEMBER_DAYS;
    return (Number.isFinite(days) && days > 0 ? days : DEFAULT_REMEMBER_DAYS) * 86400;
  }

  const raw = process.env.SESSION_DAYS?.trim();
  const days = raw ? Number(raw) : DEFAULT_SESSION_DAYS;
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_SESSION_DAYS) * 86400;
}

/** Auth je uključen kad je AUTH_REQUIRED=true (produkcija). */
export function isAuthRequired(): boolean {
  return process.env.AUTH_REQUIRED === "true";
}

/** Legacy: jedna lozinka — deprecated, koristite users tabelu. */
export function isLegacyPasswordAuth(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim()) && !isAuthRequired();
}

export function isAuthEnabled(): boolean {
  return isAuthRequired() || isLegacyPasswordAuth();
}

export function sessionCookieOptions(maxAgeSec = getSessionMaxAgeSec(true)) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
