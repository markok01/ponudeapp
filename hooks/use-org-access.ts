"use client";

import { useEffect, useState } from "react";

export function useOrgAccess() {
  const [access, setAccess] = useState({
    loading: true,
    staff: false,
    canLockQuotes: false,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/settings", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([me, settings]) => {
        if (cancelled) return;
        const authOff = me?.authEnabled === false;
        const role = me?.user?.role as string | undefined;
        const staff = authOff || role === "owner" || role === "admin";
        setAccess({
          loading: false,
          staff,
          canLockQuotes: staff || Boolean(settings?.membersCanLockQuotes),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAccess({ loading: false, staff: false, canLockQuotes: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return access;
}
