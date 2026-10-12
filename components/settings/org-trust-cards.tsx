"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { formatDate } from "@/utils/format";

export function OrgExportCard() {
  const t = useTranslations();
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: { role?: string } }) => {
        setIsOwner(d.user?.role === "owner");
      })
      .catch(() => undefined);
  }, []);

  if (!isOwner) return null;

  async function download() {
    setBusy(true);
    try {
      const res = await fetch("/api/org/export", { credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("settings.exportFailed"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      a.href = url;
      a.download = match?.[1] ?? "ponudeapp-export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settings.exportDone"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.exportFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.exportTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("settings.exportHelp")}</p>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void download()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("settings.exportButton")}
        </Button>
      </CardContent>
    </Card>
  );
}

type ActivityRow = {
  id: number;
  actor_email: string | null;
  summary: string;
  created_at: string;
};

export function OrgActivityCard() {
  const t = useTranslations();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: { role?: string } }) => {
        const role = d.user?.role;
        const ok = role === "owner" || role === "admin";
        if (cancelled) return;
        setAllowed(ok);
        if (!ok) {
          setLoading(false);
          return;
        }
        return fetch("/api/org/activity?limit=30", { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            if (cancelled) return;
            if (!Array.isArray(data)) throw new Error("bad");
            setRows(data);
          });
      })
      .catch(() => {
        if (!cancelled) toast.error(t("settings.activityLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (!allowed) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.activityTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("settings.activityHelp")}</p>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.activityEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-border/70 px-3 py-2">
                <p className="font-medium">{row.summary}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.actor_email ?? "—"} · {formatDate(row.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
