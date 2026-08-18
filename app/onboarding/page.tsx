"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAppSettings, persistAppSettings } from "@/lib/app-settings";
import { fileToDataUrl, validateLogoFile } from "@/lib/file-to-base64";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { PriceListTemplate } from "@/types";

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const logoInputId = useId();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [template, setTemplate] = useState<PriceListTemplate>("horeca");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchAppSettings().then((s) => {
      setCompanyName(s.companyName);
      setLogoPreview(s.logoDataUrl);
    });
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { organization?: { onboardingCompleted?: boolean; name?: string } }) => {
        if (d.organization?.onboardingCompleted) router.replace("/products");
        if (d.organization?.name && !companyName) setCompanyName(d.organization.name);
      })
      .catch(() => undefined);
  }, [router]);

  async function completeOnboarding(redirectTo: string) {
    const res = await fetch("/api/org/onboarding", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, complete: true }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? t("onboarding.completeFailed"));
    router.replace(redirectTo);
  }

  async function skip() {
    setBusy(true);
    try {
      await completeOnboarding("/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("onboarding.completeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveStep1() {
    setBusy(true);
    try {
      await persistAppSettings({ companyName: companyName.trim() });
      await fetch("/api/org/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, complete: false }),
      });
      toast.success(t("onboarding.saved"));
      setStep(2);
    } catch {
      toast.error(t("settings.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
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
      setLogoPreview(dataUrl);
      toast.success(t("settings.logoSaved"));
    } catch {
      toast.error(t("settings.logoUploadFailed"));
    }
  }

  async function createFromTemplate() {
    setBusy(true);
    try {
      const res = await fetch("/api/price-lists", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim() || t("lists.defaultName"),
          template,
          active: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("lists.createFailed"));
      setStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("lists.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function goImportExcel() {
    setBusy(true);
    try {
      await completeOnboarding("/upload");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("onboarding.completeFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-bg flex min-h-[100dvh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg shadow-[var(--shadow-card)]">
        <CardHeader>
          <div className="mb-3 flex justify-center">
            <AppLogo size="md" showWordmark={false} />
          </div>
          <CardTitle>{t("onboarding.title")}</CardTitle>
          <CardDescription>
            {step === 1
              ? t("onboarding.step1Hint")
              : step === 2
                ? t("onboarding.step2Hint")
                : t("onboarding.step3Hint")}
          </CardDescription>
          <p className="text-xs text-muted-foreground">{step} / 3</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ob-company">{t("settings.companyLabel")}</Label>
                <Input
                  id="ob-company"
                  value={companyName}
                  placeholder={t("settings.companyPlaceholder")}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.logoTitle")}</Label>
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed bg-muted/30 p-3">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="max-h-full object-contain" />
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("settings.noLogo")}</span>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" asChild>
                  <label htmlFor={logoInputId} className="cursor-pointer">
                    <ImagePlus className="h-4 w-4" />
                    {t("settings.uploadLogo")}
                  </label>
                </Button>
                <input
                  id={logoInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="sr-only"
                  onChange={(e) => void handleLogo(e)}
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-2">
              {(["empty", "simple", "horeca"] as PriceListTemplate[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    template === key ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => setTemplate(key)}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {template === key ? <Check className="h-3.5 w-3.5" /> : null}
                    {t(`lists.template.${key}`)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t(`lists.templateHint.${key}`)}
                  </span>
                </button>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">{t("onboarding.step2ImportHint")}</p>
            </div>
          ) : null}

          {step === 3 ? (
            <p className="text-sm text-muted-foreground">{t("onboarding.step3Hint")}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {step === 1 ? (
              <Button type="button" disabled={busy} onClick={() => void saveStep1()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("onboarding.next")}
              </Button>
            ) : null}
            {step === 2 ? (
              <>
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  {t("onboarding.back")}
                </Button>
                <Button type="button" disabled={busy} onClick={() => void createFromTemplate()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("onboarding.next")}
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void goImportExcel()}>
                  {t("onboarding.step2Import")}
                </Button>
              </>
            ) : null}
            {step === 3 ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void completeOnboarding("/products").catch((error) => {
                    toast.error(
                      error instanceof Error ? error.message : t("onboarding.completeFailed"),
                    );
                    setBusy(false);
                  });
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("onboarding.goProducts")}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void skip()}>
              {t("onboarding.skip")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
