"use client";

import { useState } from "react";
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

export default function RegisterPageClient() {
  const t = useTranslations();
  const [companyName, setCompanyName] = useState("");
  const [personName, setPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          personName,
          email,
          password,
          passwordConfirm,
        }),
      });
      const data = (await res.json()) as { error?: string; code?: string; reasons?: string[] };
      if (!res.ok) {
        toast.error(authApiMessage(t, data, "auth.registerFailed"));
        return;
      }
      toast.success(t("auth.registerCreated"));
      window.location.assign("/onboarding");
    } catch {
      toast.error(t("auth.registerFailed"));
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
          <CardTitle>{t("auth.registerTitle")}</CardTitle>
          <CardDescription>{t("auth.registerSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleSignInButton />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <p className="relative mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">
              {t("auth.orEmailPassword")}
            </p>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="personName">{t("auth.personName")}</Label>
              <Input
                id="personName"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                required
                autoFocus
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">{t("auth.companyNameOptional")}</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
              />
            </div>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">{t("auth.passwordConfirm")}</Label>
              <PasswordInput
                id="passwordConfirm"
                autoComplete="new-password"
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("auth.registerSubmit")}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="text-foreground underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
    <PublicFooter />
    </AuthPageChrome>
  );
}
