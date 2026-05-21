"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Monitor, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { formatDate } from "@/utils/format";

interface SessionRow {
  sessionId: string;
  lastSeenAt: string;
  expiresAt: string;
}

interface UserLoginRow {
  userId: number;
  email: string;
  name: string;
  role: string;
  activeSessionCount: number;
  maxDevices: number | null;
  sessions: SessionRow[];
}

export function AdminSessionsPanel() {
  const t = useTranslations();
  const adminAccess = useIsAdmin();
  const [users, setUsers] = useState<UserLoginRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sessions");
      if (res.status === 403) {
        setUsers(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users ?? []);
    } catch {
      toast.error(t("settings.sessionsLoadFailed"));
      setUsers(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (adminAccess !== "admin") return;
    void load();
  }, [adminAccess, load]);

  async function revokeAll(userId: number, email: string) {
    setRevokingId(userId);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("settings.sessionsRevoked", { email }));
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setRevokingId(null);
    }
  }

  if (adminAccess !== "admin") return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (users === null) return null;

  const loggedIn = users.filter((u) => u.activeSessionCount > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4" />
          {t("settings.sessionsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("settings.sessionsHelp")}</p>

        {loggedIn.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.sessionsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {loggedIn.map((u) => (
              <li key={u.userId} className="px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{u.name || u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email}
                      {u.role === "admin" ? ` · ${t("settings.userRoleAdmin")}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {t("settings.sessionsCount", {
                        count: u.activeSessionCount,
                        max:
                          u.maxDevices == null
                            ? t("settings.sessionsUnlimited")
                            : String(u.maxDevices),
                      })}
                    </p>
                    {u.sessions.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {u.sessions.map((s) => (
                          <li key={s.sessionId}>
                            {t("settings.sessionLastSeen", {
                              time: formatDate(s.lastSeenAt),
                            })}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={revokingId === u.userId}
                    onClick={() => void revokeAll(u.userId, u.email)}
                  >
                    {revokingId === u.userId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {t("settings.sessionsRevokeAll")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t("settings.sessionsOfflineTitle")}</p>
          <ul className="mt-1 space-y-0.5">
            {users
              .filter((u) => u.activeSessionCount === 0)
              .map((u) => (
                <li key={u.userId}>
                  {u.email}
                  {u.role === "admin" ? ` (${t("settings.userRoleAdmin")})` : ""}
                </li>
              ))}
          </ul>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          {t("settings.sessionsRefresh")}
        </Button>
      </CardContent>
    </Card>
  );
}
