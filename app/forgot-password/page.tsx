"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageChrome } from "@/components/auth/auth-page-chrome";
import { PublicFooter } from "@/components/marketing/public-shell";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("common.error"));
      setSent(true);
      toast.success(t("auth.forgotSent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageChrome>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader>
            <AppLogo size="md" appName={t("common.appName")} />
            <CardTitle className="pt-4">{t("auth.forgotTitle")}</CardTitle>
            <CardDescription>{t("auth.forgotSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-sm text-muted-foreground">{t("auth.forgotSent")}</p>
            ) : (
              <form onSubmit={(e) => void submit(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("auth.forgotSend")}
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
      </div>
      <PublicFooter />
    </AuthPageChrome>
  );
}
