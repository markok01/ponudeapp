"use client";

import { useEffect } from "react";
import {
  setDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-install";

/** Hvata Chrome/Edge beforeinstallprompt jednom za banner i Podešavanja. */
export function InstallPromptCapture() {
  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  return null;
}
