"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPublicPath } from "@/lib/public-paths";

type MePayload = {
  authEnabled?: boolean;
  authenticated?: boolean;
  user?: { role?: string } | null;
  organization?: { onboardingCompleted?: boolean } | null;
};

/** Šalje owner/admin na wizard dok org nema onboarding_completed. */
export function OnboardingGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isPublicPath(pathname)) return;
    if (pathname.startsWith("/onboarding")) return;
    if (pathname.startsWith("/internal")) return;

    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((data: MePayload) => {
        if (cancelled) return;
        if (!data.authEnabled || !data.authenticated) return;
        const role = data.user?.role;
        if (role !== "owner" && role !== "admin") return;
        if (data.organization?.onboardingCompleted === false) {
          router.replace("/onboarding");
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
