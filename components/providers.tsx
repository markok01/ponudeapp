"use client";

import { SessionGuard } from "@/components/auth/session-guard";
import { AppToaster } from "@/components/ui/app-toaster";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { PwaInstallBanner } from "@/components/pwa/install-banner";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <SessionGuard />
        {children}
        <PwaInstallBanner />
        <AppToaster />
      </LocaleProvider>
    </ThemeProvider>
  );
}
