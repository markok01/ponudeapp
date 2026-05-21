"use client";

import { useEffect, useState } from "react";

export type AdminAccessState = "loading" | "admin" | "not-admin";

/** Da li je prijavljeni korisnik administrator (samo tada admin UI i API). */
export function useIsAdmin(): AdminAccessState {
  const [state, setState] = useState<AdminAccessState>("loading");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { authEnabled?: boolean; user?: { role?: string } | null }) => {
        if (cancelled) return;
        if (!data.authEnabled) {
          setState("not-admin");
          return;
        }
        setState(data.user?.role === "admin" ? "admin" : "not-admin");
      })
      .catch(() => {
        if (!cancelled) setState("not-admin");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
