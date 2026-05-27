import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearSessionCookieOptions,
  isAuthEnabled,
  SESSION_COOKIE,
} from "@/lib/auth-config";
import { parseSessionToken } from "@/lib/session-token";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/settings") return true;
  if (pathname === "/api/health") return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function denyAccess(request: NextRequest, pathname: string) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hadSessionCookie = Boolean(token);
  const jwtStillValid = Boolean(parseSessionToken(token));

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("next", pathname);
  loginUrl.searchParams.set(
    "reason",
    hadSessionCookie ? "session_revoked" : "auth_required",
  );
  const res = NextResponse.redirect(loginUrl);
  if (hadSessionCookie && !jwtStillValid) {
    res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  }
  return res;
}

type AuthMe = {
  authenticated?: boolean;
  user?: { role?: string } | null;
};

/** Samo za /api/admin — provera uloge ide preko Node API rute. */
async function fetchAuthMe(request: NextRequest): Promise<AuthMe | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !parseSessionToken(token)) return null;

  try {
    const meUrl = new URL("/api/auth/me", request.nextUrl.origin);
    const res = await fetch(meUrl, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "x-forwarded-host": request.headers.get("host") ?? "",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthMe;
  } catch {
    return null;
  }
}

/** JWT provera u proxy — bez internog fetch-a ka bazi (nestabilno na Vercelu). */
function sessionIsValid(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token) !== null;
}

export async function proxy(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && sessionIsValid(request)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!sessionIsValid(request)) {
    return denyAccess(request, pathname);
  }

  if (pathname.startsWith("/api/admin")) {
    const me = await fetchAuthMe(request);
    if (me?.user?.role !== "admin") {
      return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
