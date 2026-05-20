"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminUsersPanel } from "@/components/settings/admin-users-panel";
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
import { cn } from "@/lib/utils";

export default function SettingsPage() {
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
      toast.success("Logo sačuvan (sinhronizovano sa serverom)");
    } catch {
      toast.error("Upload logotipa nije uspeo");
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
    toast.success("Logo uklonjen");
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await persistAppSettings({ companyName: companyName.trim() });
      toast.success("Podešavanja sačuvana na serveru");
    } catch {
      toast.error("Čuvanje nije uspelo");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell title="Podešavanja" description="Učitavanje...">
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Podešavanja"
      description="Logo i naziv firme za PDF ponude (deljeno između uređaja)"
    >
      <div className="mx-auto w-full max-w-xl space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Logo kompanije
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Logo se čuva u bazi i koristi na svim PDF ponudama sa bilo kog uređaja.
            </p>
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
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Nema logotipa</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                <label htmlFor={logoInputId} className="cursor-pointer">
                  <ImagePlus className="h-4 w-4" />
                  Upload logo
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
                  Ukloni
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
            <CardTitle>Naziv firme</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSaveCompany(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Prikaz u PDF headeru</Label>
                <Input
                  id="company"
                  placeholder="Npr. Moja firma d.o.o."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Sačuvaj
              </Button>
            </form>
          </CardContent>
        </Card>

        <AdminUsersPanel />
      </div>
    </DashboardShell>
  );
}
