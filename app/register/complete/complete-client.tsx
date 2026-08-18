"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { AuthPageChrome } from "@/components/auth/auth-page-chrome";
import { authApiMessage } from "@/lib/auth-api-error";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { safeNextPath } from "@/lib/safe-next-path";

export default function GoogleCompleteClient() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [personName, setPersonName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [next, setNext] = useState("/");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/google/complete", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          toast.error(t("auth.googlePendingExpired"));
          router.replace("/register");
          return;
        }
        const data = (await res.json()) as {
          email?: string;
          name?: string;
          next?: string;
        };
        if (cancelled) return;
        setEmail(data.email ?? "");
        setPersonName(data.name ?? "");
        setNext(safeNextPath(data.next));
        setReady(true);
      })
      .catch(() => {
        toast.error(t("auth.googlePendingExpired"));
        router.replace("/register");
      });
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personName, companyName }),
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

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthPageChrome>
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <AppLogo size="lg" showWordmark={false} />
          </div>
          <CardTitle>{t("auth.googleCompleteTitle")}</CardTitle>
          <CardDescription>{t("auth.googleCompleteSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} disabled readOnly />
            </div>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("auth.googleCompleteSubmit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </AuthPageChrome>
  );
}
