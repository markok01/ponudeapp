"use client";

import { Toaster } from "sonner";
import { SessionGuard } from "@/components/auth/session-guard";
import { PwaInstallBanner } from "@/components/pwa/install-banner";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionGuard />
      {children}
      <PwaInstallBanner />
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast:
              "rounded-xl border border-border bg-card text-foreground shadow-[var(--shadow-card)] backdrop-blur-sm",
            title: "font-medium",
            description: "text-muted-foreground text-sm",
            success: "border-success/30",
            error: "border-destructive/30",
          },
        }}
        closeButton
        richColors
      />
    </ThemeProvider>
  );
}
