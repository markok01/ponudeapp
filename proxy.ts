import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearSessionCookieOptions,
  isAuthEnabled,
  SESSION_COOKIE,
} from "@/lib/auth-config";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/health") return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function denyAccess(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    const res = NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
    res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
    return res;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  loginUrl.searchParams.set("reason", "session_revoked");
  const res = NextResponse.redirect(loginUrl);
  res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return res;
}

type AuthMe = {
  authenticated?: boolean;
  user?: { role?: string } | null;
};

/** Provera sesije preko Node API rute (crypto + baza nisu dostupni u proxy). */
async function fetchAuthMe(request: NextRequest): Promise<AuthMe | null> {
  if (!request.cookies.get(SESSION_COOKIE)?.value) return null;

  try {
    const meUrl = new URL("/api/auth/me", request.url);
    const res = await fetch(meUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthMe;
  } catch {
    return null;
  }
}

async function sessionIsValid(request: NextRequest): Promise<boolean> {
  const data = await fetchAuthMe(request);
  return data?.authenticated === true;
}

export async function proxy(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && (await sessionIsValid(request))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!(await sessionIsValid(request))) {
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
