import type { AppSettings } from "@/types";

const STORAGE_KEY = "ponudeapp-settings";

const DEFAULTS: AppSettings = {
  logoDataUrl: null,
  companyName: "",
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAppSettingsLocal(): AppSettings {
  if (!canUseStorage()) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      logoDataUrl:
        typeof parsed.logoDataUrl === "string" ? parsed.logoDataUrl : null,
      companyName:
        typeof parsed.companyName === "string" ? parsed.companyName : "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppSettingsLocal(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getAppSettingsLocal(), ...patch };
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearAppLogoLocal(): AppSettings {
  return saveAppSettingsLocal({ logoDataUrl: null });
}

/** Učitava iz API-ja, kešira u localStorage. */
export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) return getAppSettingsLocal();
    const data = (await res.json()) as AppSettings;
    saveAppSettingsLocal(data);
    return data;
  } catch {
    return getAppSettingsLocal();
  }
}

/** Čuva u API i localStorage. */
export async function persistAppSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const local = { ...getAppSettingsLocal(), ...patch };
  saveAppSettingsLocal(local);

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local),
    });
    if (res.ok) {
      const data = (await res.json()) as AppSettings;
      saveAppSettingsLocal(data);
      return data;
    }
  } catch {
    /* offline — local only */
  }

  return local;
}

// Backward-compatible aliases
export const getAppSettings = getAppSettingsLocal;
export const saveAppSettings = saveAppSettingsLocal;
export const clearAppLogo = clearAppLogoLocal;
