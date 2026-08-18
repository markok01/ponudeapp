"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { AuthPageChrome } from "@/components/auth/auth-page-chrome";
import { authApiMessage } from "@/lib/auth-api-error";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function InviteAcceptClient() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : t("auth.inviteInvalid"),
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [preview, setPreview] = useState<{
    email: string;
    name: string;
    companyName: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          error?: string;
          code?: string;
          email?: string;
          name?: string;
          companyName?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(authApiMessage(t, data, "auth.inviteInvalid"));
          return;
        }
        setPreview({
          email: data.email ?? "",
          name: data.name ?? "",
          companyName: data.companyName ?? "",
        });
        setName(data.name ?? "");
      })
      .catch(() => {
        if (!cancelled) setError(t("auth.inviteInvalid"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm, name }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        reasons?: string[];
      };
      if (!res.ok) {
        toast.error(authApiMessage(t, data, "auth.inviteAcceptFailed"));
        return;
      }
      toast.success(t("auth.inviteAccepted"));
      router.push("/login");
    } catch {
      toast.error(t("auth.inviteAcceptFailed"));
    } finally {
      setSaving(false);
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
          <CardTitle>{t("auth.inviteTitle")}</CardTitle>
          <CardDescription>
            {preview
              ? t("auth.inviteSubtitle", { company: preview.companyName })
              : t("auth.inviteTitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button asChild className="w-full">
                <Link href="/login">{t("auth.backToLogin")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("auth.email")}</Label>
                <Input value={preview?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">{t("auth.personName")}</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">{t("auth.password")}</Label>
                <PasswordInput
                  id="invite-password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password-confirm">
                  {t("auth.passwordConfirm")}
                </Label>
                <PasswordInput
                  id="invite-password-confirm"
                  autoComplete="new-password"
                  minLength={8}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("auth.inviteAccept")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
    </AuthPageChrome>
  );
}
