"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { AuthPageChrome } from "@/components/auth/auth-page-chrome";
import { PublicFooter } from "@/components/marketing/public-shell";
import { authApiMessage } from "@/lib/auth-api-error";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { safeNextPath } from "@/lib/safe-next-path";

export default function LoginPageClient() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const revoked = searchParams.get("reason") === "session_revoked";
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (revoked) {
      toast.info(t("auth.sessionRevoked"));
    }
    if (oauthError === "google_unverified") toast.error(t("auth.googleUnverified"));
    else if (oauthError === "google_no_account") toast.error(t("auth.googleNoAccount"));
    else if (oauthError === "google_not_configured") {
      toast.error(t("auth.googleNotConfigured"));
    } else if (oauthError === "google_denied") toast.error(t("auth.googleDenied"));
    else if (oauthError === "google_mismatch") toast.error(t("auth.googleMismatch"));
    else if (oauthError === "google_inactive") toast.error(t("auth.googleInactive"));
    else if (oauthError === "org_suspended") toast.error(t("auth.orgSuspended"));
    else if (oauthError === "device_limit") toast.error(t("auth.deviceLimit"));
    else if (oauthError) toast.error(t("auth.googleFailed"));
  }, [revoked, oauthError, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        reasons?: string[];
      };
      if (!res.ok) {
        toast.error(authApiMessage(t, data, "auth.signInFailed"));
        return;
      }

      toast.success(t("auth.signInSuccess"));
      const meRes = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const me = (await meRes.json()) as {
        organization?: { onboardingCompleted?: boolean };
      };
      if (me.organization?.onboardingCompleted === false) {
        window.location.assign("/onboarding");
        return;
      }
      window.location.assign(next);
    } catch {
      toast.error(t("auth.signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageChrome>
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <AppLogo size="lg" showWordmark={false} />
          </div>
          <CardTitle>{t("auth.loginTitle")}</CardTitle>
          <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {t("auth.rememberMe")}
            </label>
            <p className="text-right text-xs">
              <Link href="/forgot-password" className="text-muted-foreground underline">
                {t("auth.forgotPassword")}
              </Link>
            </p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("auth.signIn")}
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <p className="relative mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">
              {t("auth.orEmailPassword")}
            </p>
          </div>
          <GoogleSignInButton remember={remember} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="text-foreground underline">
              {t("auth.registerLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
    <PublicFooter />
    </AuthPageChrome>
  );
}
