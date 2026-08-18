"use client";

import { AuthLanguageSwitcher } from "@/components/auth/auth-language-switcher";

export function AuthPageChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-bg flex min-h-[100dvh] flex-col">
      <div className="flex justify-end px-4 py-3 sm:px-6">
        <AuthLanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
