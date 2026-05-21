"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminSessionsPanel } from "@/components/settings/admin-sessions-panel";
import { AdminUsersPanel } from "@/components/settings/admin-users-panel";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { LanguageSettingsCard } from "@/components/settings/language-settings-card";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearAppLogoLocal,
  fetchAppSettings,
  persistAppSettings,
} from "@/lib/app-settings";
import {
  fileToDataUrl,
  validateLogoFile,
} from "@/lib/file-to-base64";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const t = useTranslations();
  const adminAccess = useIsAdmin();
  const logoInputId = useId();
  const [companyName, setCompanyName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    void fetchAppSettings().then((settings) => {
      setCompanyName(settings.companyName);
      setLogoPreview(settings.logoDataUrl);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (previewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const error = validateLogoFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      await persistAppSettings({ logoDataUrl: dataUrl });
      if (previewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(previewRef.current);
      }
      setLogoPreview(dataUrl);
      toast.success(t("settings.logoSaved"));
    } catch {
      toast.error(t("settings.logoUploadFailed"));
    }
  }

  async function handleRemoveLogo() {
    await persistAppSettings({ logoDataUrl: null });
    clearAppLogoLocal();
    if (previewRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = null;
    setLogoPreview(null);
    toast.success(t("settings.logoRemoved"));
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await persistAppSettings({ companyName: companyName.trim() });
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell title={t("settings.title")} description={t("common.loading")}>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t("settings.title")} description={t("settings.description")}>
      <div className="mx-auto w-full max-w-xl space-y-4 sm:space-y-6">
        <LanguageSettingsCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t("settings.logoTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("settings.logoHelp")}</p>
            <div
              className={cn(
                "flex h-28 items-center justify-center rounded-xl border border-dashed border-input bg-muted/30 p-3",
                logoPreview && "border-solid bg-white",
              )}
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain object-center"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("settings.noLogo")}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                <label htmlFor={logoInputId} className="cursor-pointer">
                  <ImagePlus className="h-4 w-4" />
                  {t("settings.uploadLogo")}
                </label>
              </Button>
              {logoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => void handleRemoveLogo()}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("common.remove")}
                </Button>
              )}
            </div>
            <input
              id={logoInputId}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="sr-only"
              onChange={handleLogoChange}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.companyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSaveCompany(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">{t("settings.companyLabel")}</Label>
                <Input
                  id="company"
                  placeholder={t("settings.companyPlaceholder")}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("common.save")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {adminAccess === "admin" ? (
          <>
            <AdminSessionsPanel />
            <AdminUsersPanel />
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
