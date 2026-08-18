"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthPageChrome } from "@/components/auth/auth-page-chrome";
import { authApiMessage } from "@/lib/auth-api-error";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function VerifyEmailClient() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const missingToken = !token;
  const [state, setState] = useState<"loading" | "ok" | "error">(
    missingToken ? "error" : "loading",
  );
  const [message, setMessage] = useState(
    missingToken ? t("auth.verifyMissingToken") : "",
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as { error?: string; code?: string };
        if (cancelled) return;
        if (!res.ok) {
          setState("error");
          setMessage(authApiMessage(t, data, "auth.verifyFailed"));
          return;
        }
        setState("ok");
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
          setMessage(t("auth.verifyFailed"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <AuthPageChrome>
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <AppLogo size="lg" showWordmark={false} />
          </div>
          <CardTitle>{t("auth.verifyTitle")}</CardTitle>
          <CardDescription>
            {state === "loading"
              ? t("common.loading")
              : state === "ok"
                ? t("auth.verifySuccess")
                : t("auth.verifyFailed")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state === "loading" ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : null}
          {state === "error" && message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          {state !== "loading" ? (
            <Button asChild className="w-full">
              <Link href="/login">{t("auth.backToLogin")}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
    </AuthPageChrome>
  );
}
