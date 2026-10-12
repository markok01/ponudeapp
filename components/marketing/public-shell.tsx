"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { AuthLanguageSwitcher } from "@/components/auth/auth-language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-provider";

export function PublicFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-card/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">
          © {year} {t("common.appName")}. {t("marketing.footerNote")}
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            {t("marketing.navPricing")}
          </Link>
          <Link href="/legal/terms" className="text-muted-foreground hover:text-foreground">
            {t("legal.termsNav")}
          </Link>
          <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground">
            {t("legal.privacyNav")}
          </Link>
          <Link href="/legal/dpa" className="text-muted-foreground hover:text-foreground">
            {t("legal.dpaNav")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d: { authenticated?: boolean }) => setSignedIn(Boolean(d.authenticated)))
      .catch(() => undefined);
  }, []);

  return (
    <div className="dashboard-bg flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="min-w-0">
            <AppLogo size="sm" appName={t("common.appName")} />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/pricing"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
            >
              {t("marketing.navPricing")}
            </Link>
            <AuthLanguageSwitcher />
            <ThemeToggle />
            {signedIn ? (
              <Button asChild size="sm">
                <Link href="/app">{t("common.open")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">{t("auth.signIn")}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">{t("marketing.ctaRegister")}</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
