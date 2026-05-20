"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const t = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="h-9 w-[4.25rem] rounded-full bg-muted/80"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t("theme.light") : t("theme.dark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-[4.25rem] shrink-0 items-center rounded-full border p-0.5 transition-all duration-300 ease-out",
        "border-border/80 bg-secondary/80 shadow-sm",
        "hover:border-primary/30 hover:shadow-[0_0_12px_rgba(91,141,239,0.15)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDark && "border-primary/25 bg-muted shadow-[0_0_14px_rgba(123,163,245,0.12)]",
      )}
    >
      <Sun
        className={cn(
          "absolute left-2.5 h-3.5 w-3.5 text-amber-500/90 transition-opacity duration-300",
          isDark ? "opacity-40" : "opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute right-2.5 h-3.5 w-3.5 text-primary/80 transition-opacity duration-300",
          isDark ? "opacity-100" : "opacity-40",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute top-0.5 h-7 w-7 rounded-full bg-card shadow-md transition-transform duration-300 ease-out",
          "border border-border/60",
          isDark ? "translate-x-[2.125rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
