"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

const CHECK_INTERVAL_MS = 10_000;

/** Proverava sesiju u pozadini — odmah izbacuje deaktiviranog korisnika. */
export function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  const check = useCallback(async () => {
    if (pathname === "/login" || pathname.startsWith("/login/")) return;

    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as {
        authEnabled?: boolean;
        authenticated?: boolean;
      };
      if (data.authEnabled === true && data.authenticated === false) {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login?reason=session_revoked");
        router.refresh();
      }
    } catch {
      /* mreža — preskoči */
    }
  }, [pathname, router]);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [check]);

  return null;
}
