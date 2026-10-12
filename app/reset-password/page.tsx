"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageChrome } from "@/components/auth/auth-page-chrome";
import { PublicFooter } from "@/components/marketing/public-shell";
import { useTranslations } from "@/lib/i18n/locale-provider";

function ResetPasswordForm() {
  const t = useTranslations();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("auth.resetInvalid"));
      setDone(true);
      toast.success(t("auth.resetDone"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.resetInvalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <AppLogo size="md" appName={t("common.appName")} />
        <CardTitle className="pt-4">{t("auth.resetTitle")}</CardTitle>
        <CardDescription>{t("auth.resetSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <p className="text-sm text-muted-foreground">{t("auth.resetInvalid")}</p>
        ) : done ? (
          <p className="text-sm text-muted-foreground">{t("auth.resetDone")}</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("auth.resetSave")}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-xs">
          <Link href="/login" className="text-muted-foreground underline">
            {t("auth.forgotBack")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthPageChrome>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <PublicFooter />
    </AuthPageChrome>
  );
}
