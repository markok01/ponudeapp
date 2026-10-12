"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileType2,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

const NAV_PATHS = [
  "/app",
  "/products",
  "/upload",
  "/pdf-to-excel",
  "/customers",
  "/quotes",
  "/quotes/new",
  "/settings",
] as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const [authEnabled, setAuthEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(true);

  const labels = useMemo(
    () => ({
      home: t("nav.home"),
      products: t("nav.products"),
      upload: t("nav.upload"),
      pdfToExcel: t("nav.pdfToExcel"),
      quotes: t("nav.quotes"),
      customers: t("nav.customers"),
      newQuote: t("nav.newQuote"),
      settings: t("nav.settings"),
      logout: t("nav.logout"),
      tagline: t("nav.tagline"),
      catalog: t("common.catalog"),
      appName: t("common.appName"),
    }),
    [t],
  );

  const navItems = useMemo(
    () => [
      { href: "/app", label: labels.home, icon: LayoutDashboard },
      { href: "/products", label: labels.products, icon: Package },
      ...(isStaff
        ? [{ href: "/upload", label: labels.upload, icon: Upload }]
        : []),
      { href: "/pdf-to-excel", label: labels.pdfToExcel, icon: FileType2 },
      { href: "/customers", label: labels.customers, icon: Users },
      { href: "/quotes", label: labels.quotes, icon: FileSpreadsheet },
      { href: "/quotes/new", label: labels.newQuote, icon: PlusCircle },
      { href: "/settings", label: labels.settings, icon: Settings },
    ],
    [labels, isStaff],
  );

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setAuthEnabled(Boolean(d.authEnabled));
          if (d.user?.email) setUserEmail(d.user.email);
          const role = d.user?.role as string | undefined;
          setIsStaff(!d.authEnabled || role === "admin" || role === "owner");
        })
        .catch(() => {
          if (!cancelled) setAuthEnabled(false);
        });
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 800 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col p-3.5 pb-[env(safe-area-inset-bottom)] sm:p-4">
      <div className="mb-5 border-b border-border/70 px-1.5 pb-4">
        <AppLogo
          size="md"
          appName={labels.appName}
          tagline={labels.catalog}
        />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/app"
              ? pathname === "/app"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              prefetch={NAV_PATHS.includes(href as (typeof NAV_PATHS)[number])}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      {authEnabled ? (
        <div className="mt-4 space-y-2 border-t border-border/70 pt-3">
          {userEmail ? (
            <p className="truncate px-1 text-[11px] text-muted-foreground">
              {userEmail}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            {labels.logout}
          </Button>
        </div>
      ) : null}
      <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted-foreground/75">
        {labels.tagline}
      </p>
    </aside>
  );
}
