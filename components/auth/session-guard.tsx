"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 10_000;
const RETRY_DELAY_MS = 800;
const LOGOUT_FAIL_THRESHOLD = 3;

/** Proverava sesiju u pozadini — izbacuje deaktiviranog korisnika nakon više uzastopnih potvrda. */
export function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const failCountRef = useRef(0);

  const check = useCallback(async () => {
    if (pathname === "/login" || pathname.startsWith("/login/")) return;

    async function fetchMe() {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 503) return null;
      if (!res.ok) return null;
      return (await res.json()) as {
        authEnabled?: boolean;
        authenticated?: boolean;
      };
    }

    try {
      let data = await fetchMe();
      if (data?.authEnabled === true && data.authenticated === false) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        data = await fetchMe();
      }

      if (data?.authEnabled === true && data.authenticated === false) {
        failCountRef.current += 1;
        if (failCountRef.current < LOGOUT_FAIL_THRESHOLD) return;

        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        router.replace("/login?reason=session_revoked");
        router.refresh();
        return;
      }

      if (data?.authenticated === true) {
        failCountRef.current = 0;
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
