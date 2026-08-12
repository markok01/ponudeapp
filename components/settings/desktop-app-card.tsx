"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-provider";
import {
  downloadDesktopShortcut,
  getDeferredInstallPrompt,
  isStandaloneDisplay,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "@/lib/pwa-install";

export function DesktopAppCard() {
  const t = useTranslations();
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setCanInstall(Boolean(getDeferredInstallPrompt()));
    return subscribeInstallPrompt(() => {
      setCanInstall(Boolean(getDeferredInstallPrompt()));
      setInstalled(isStandaloneDisplay());
    });
  }, []);

  async function handleCreateDesktopApp() {
    setBusy(true);
    try {
      if (canInstall) {
        const outcome = await promptPwaInstall();
        if (outcome === "accepted") {
          setInstalled(true);
          setCanInstall(false);
          toast.success(t("settings.desktopInstalled"));
          return;
        }
        if (outcome === "dismissed") {
          toast.message(t("settings.desktopInstallDismissed"));
          return;
        }
      }

      const origin = window.location.origin;
      const { filename } = downloadDesktopShortcut(origin, "PonudeApp");
      toast.success(t("settings.desktopShortcutReady", { file: filename }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5 text-primary" />
          {t("settings.desktopTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-[1.35rem] bg-primary/25 blur-xl"
              aria-hidden
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon.svg"
              alt="PonudeApp"
              width={88}
              height={88}
              className="relative h-[88px] w-[88px] rounded-[1.35rem] shadow-lg ring-1 ring-black/5"
            />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-base font-semibold tracking-tight">PonudeApp</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("settings.desktopHelp")}
            </p>
            {installed ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {t("settings.desktopAlreadyInstalled")}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={busy || installed}
          onClick={() => void handleCreateDesktopApp()}
        >
          <Download className="h-4 w-4" />
          {installed
            ? t("settings.desktopInstalled")
            : canInstall
              ? t("settings.desktopInstall")
              : t("settings.desktopCreateLink")}
        </Button>

        {!installed ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {canInstall ? t("settings.desktopInstallHint") : t("settings.desktopLinkHint")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
