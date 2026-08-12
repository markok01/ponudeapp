"use client";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  notify();
}

export function subscribeInstallPrompt(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function downloadDesktopShortcut(appUrl: string, appName = "PonudeApp") {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  const isMac =
    /Mac|iPhone|iPad|iPod/.test(platform) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  let filename: string;
  let mime: string;
  let content: string;

  if (isMac) {
    filename = `${appName}.webloc`;
    mime = "application/xml";
    content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>${appUrl}</string>
</dict>
</plist>
`;
  } else {
    filename = `${appName}.url`;
    mime = "application/internet-shortcut";
    content = `[InternetShortcut]\r\nURL=${appUrl}\r\nIconFile=${appUrl}/icons/icon.svg\r\nIconIndex=0\r\n`;
  }

  const blob = new Blob([content], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);

  return { filename, kind: isMac ? ("webloc" as const) : ("url" as const) };
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const promptEvent = deferredPrompt;
  if (!promptEvent) return "unavailable";
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  setDeferredInstallPrompt(null);
  return outcome;
}
