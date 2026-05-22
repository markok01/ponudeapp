"use client";

import { Toaster } from "sonner";
import { useMaxMdViewport } from "@/hooks/use-max-md-viewport";

export function AppToaster() {
  const maxMd = useMaxMdViewport();

  return (
    <Toaster
      position={maxMd ? "bottom-center" : "top-right"}
      offset={maxMd ? "max(1rem, env(safe-area-inset-bottom))" : undefined}
      mobileOffset={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
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
  );
}
