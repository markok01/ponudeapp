"use client";

import { useEffect, useState } from "react";

export type AdminAccessState = "loading" | "admin" | "not-admin";

/** Owner i admin vide staff UI (korisnici, invite, logo). */
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
        setState(data.user?.role === "admin" || data.user?.role === "owner" ? "admin" : "not-admin");
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
