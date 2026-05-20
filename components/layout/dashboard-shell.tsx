"use client";

import { Menu } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
  actions?: React.ReactNode;
  printClassName?: string;
  /** Pun širina — sidebar samo preko menija (nova/izmena ponude). */
  variant?: "default" | "workspace";
}

export function DashboardShell({
  title,
  description,
  breadcrumbs,
  children,
  actions,
  printClassName,
  variant = "default",
}: DashboardShellProps) {
  const t = useTranslations();
  const isWorkspace = variant === "workspace";
  const [navOpen, setNavOpen] = useState(false);
  const [desktopNav, setDesktopNav] = useState(false);
  const sidebarPinned = desktopNav && !isWorkspace;

  const closeNav = useCallback(() => setNavOpen(false), []);
  const openNav = useCallback(() => setNavOpen(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktopNav(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  useEffect(() => {
    closeNav();
  }, [title, closeNav]);

  return (
    <div
      className={cn(
        "dashboard-bg flex min-h-[100dvh] min-h-screen",
        isWorkspace &&
          "dashboard-workspace h-[100dvh] max-h-[100dvh] overflow-hidden",
        printClassName,
      )}
    >
      <button
        type="button"
        aria-label={t("nav.closeMenu")}
        aria-hidden={!navOpen}
        tabIndex={navOpen ? 0 : -1}
        className={cn(
          "app-overlay app-overlay-drawer fixed inset-0 z-30 bg-foreground/25",
          !isWorkspace && "lg:hidden",
        )}
        data-open={navOpen}
        onClick={closeNav}
      />

      <aside
        className={cn(
          "app-sidebar app-sidebar-drawer glass-panel fixed inset-y-0 left-0 z-40 flex w-[min(100vw-3rem,17.5rem)] shrink-0 flex-col border-r",
          !isWorkspace &&
            "app-sidebar-pinned lg:static lg:z-auto lg:w-[17.5rem]",
        )}
        data-open={isWorkspace ? navOpen : navOpen || sidebarPinned}
        aria-hidden={isWorkspace ? !navOpen : !sidebarPinned && !navOpen}
      >
        <Sidebar onNavigate={closeNav} />
      </aside>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          isWorkspace && "min-h-0 overflow-hidden",
        )}
      >
        <header
          className={cn(
            "app-header glass-navbar sticky top-0 z-20 border-b pt-[max(0.75rem,env(safe-area-inset-top))]",
            isWorkspace
              ? "px-2 py-2 sm:px-3 lg:px-4"
              : "px-3 py-3 sm:px-4 lg:px-6",
          )}
        >
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "app-menu-btn h-10 w-10 shrink-0",
                  !isWorkspace && "lg:hidden",
                )}
                onClick={openNav}
                aria-expanded={navOpen}
                aria-label={t("nav.openMenu")}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                {breadcrumbs?.length ? (
                  <Breadcrumbs items={breadcrumbs} className="print-breadcrumbs" />
                ) : null}
                <h2
                  className={cn(
                    "truncate font-semibold tracking-tight",
                    isWorkspace
                      ? "text-base sm:text-lg"
                      : "text-lg sm:text-xl lg:text-2xl",
                  )}
                >
                  {title}
                </h2>
                {description ? (
                  <p
                    className={cn(
                      "mt-0.5 text-muted-foreground print-description",
                      isWorkspace
                        ? "line-clamp-1 text-[11px] sm:text-xs"
                        : "line-clamp-2 text-xs sm:text-sm",
                    )}
                  >
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
        <main
          className={cn(
            "flex-1",
            isWorkspace
              ? "flex min-h-0 flex-col overflow-hidden px-1.5 py-2 sm:px-2 sm:py-2 lg:px-3"
              : "px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-5 lg:px-6 lg:py-6",
          )}
        >
          <div className={cn("min-w-0", isWorkspace && "flex min-h-0 flex-1 flex-col")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
