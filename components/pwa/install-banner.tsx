"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-provider";
import {
  getDeferredInstallPrompt,
  isStandaloneDisplay,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "@/lib/pwa-install";

const DISMISS_KEY = "ponudeapp-pwa-install-dismissed";

export function PwaInstallBanner() {
  const t = useTranslations();
  const [canInstall, setCanInstall] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isIosHint, setIsIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    if (isStandaloneDisplay()) return;

    const ua = navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIos) {
      setIsIosHint(true);
      setVisible(true);
      return;
    }

    const sync = () => {
      const ready = Boolean(getDeferredInstallPrompt());
      setCanInstall(ready);
      if (ready) setVisible(true);
    };
    sync();
    return subscribeInstallPrompt(sync);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function install() {
    const outcome = await promptPwaInstall();
    if (outcome !== "unavailable") dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto max-w-lg no-print max-lg:bottom-[max(4.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-start gap-3 rounded-[var(--radius)] border border-primary/20 bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon.svg"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-xl shadow-sm ring-1 ring-black/5"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("pwa.installTitle")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isIosHint ? t("pwa.iosHint") : t("pwa.installDesc")}
          </p>
          {!isIosHint && canInstall ? (
            <Button size="sm" className="mt-3" onClick={() => void install()}>
              <Download className="h-4 w-4" />
              {t("pwa.install")}
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={dismiss}
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
