"use client";

import { SessionGuard } from "@/components/auth/session-guard";
import { OnboardingGuard } from "@/components/auth/onboarding-guard";
import { AppToaster } from "@/components/ui/app-toaster";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { PwaInstallBanner } from "@/components/pwa/install-banner";
import { InstallPromptCapture } from "@/components/pwa/install-prompt-capture";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <InstallPromptCapture />
        <SessionGuard />
        <OnboardingGuard />
        {children}
        <PwaInstallBanner />
        <AppToaster />
      </LocaleProvider>
    </ThemeProvider>
  );
}
