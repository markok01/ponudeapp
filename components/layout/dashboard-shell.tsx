"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** Klasa za print layout (npr. quote-detail-print) */
  printClassName?: string;
}

export function DashboardShell({
  title,
  description,
  breadcrumbs,
  children,
  actions,
  printClassName,
}: DashboardShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <div className={cn("dashboard-bg flex min-h-[100dvh] min-h-screen", printClassName)}>
      <div
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-40 w-[min(100vw-3rem,17.5rem)] transition-transform duration-300 ease-out",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </div>
      {navOpen ? (
        <button
          type="button"
          aria-label="Zatvori meni"
          className="app-overlay fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px]"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header glass-navbar sticky top-0 z-20 border-b px-3 py-3 sm:px-4 lg:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="icon"
                className="app-menu-btn h-10 w-10 shrink-0"
                onClick={() => setNavOpen(true)}
                aria-expanded={navOpen}
                aria-label="Otvori meni"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                {breadcrumbs?.length ? (
                  <Breadcrumbs items={breadcrumbs} className="print-breadcrumbs" />
                ) : null}
                <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl lg:text-2xl">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm print-description">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="app-header-actions flex shrink-0 items-center gap-2 sm:gap-3">
              {actions ? (
                <div className="hidden items-center gap-2 md:flex">{actions}</div>
              ) : null}
              <ThemeToggle />
            </div>
          </div>
          {actions ? (
            <div className="app-header-actions mt-3 flex flex-col gap-2 sm:flex-row md:hidden">
              {actions}
            </div>
          ) : null}
        </header>
        <main className="flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
