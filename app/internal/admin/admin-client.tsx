"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { OrgPlan, OrgStatus } from "@/services/organizations";

type OrgRow = {
  id: number;
  name: string;
  slug: string;
  plan: OrgPlan;
  status: OrgStatus;
  trial_ends_at: string | null;
  user_count: number;
  created_at: string;
};

export default function InternalAdminClient() {
  const t = useTranslations();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [pending, setPending] = useState<OrgRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/internal/admin/orgs", {
      cache: "no-store",
      credentials: "include",
    });
    if (res.status === 401 || res.status === 403) {
      setForbidden(true);
      setOrgs([]);
      return;
    }
    const data = (await res.json()) as { orgs?: OrgRow[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? t("internal.loadFailed"));
    setForbidden(false);
    setOrgs(data.orgs ?? []);
  }, [t]);

  useEffect(() => {
    void load()
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("internal.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [load, t]);

  async function applyStatus(org: OrgRow, status: "active" | "suspended") {
    setBusy(true);
    try {
      const res = await fetch(`/api/internal/admin/orgs/${org.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("internal.actionFailed"));
      toast.success(status === "suspended" ? t("internal.suspended") : t("internal.activated"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("internal.actionFailed"));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <div className="dashboard-bg min-h-[100dvh] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("internal.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("internal.subtitle")}</p>
          </div>
          <ThemeToggle />
        </div>
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : forbidden ? (
          <p className="text-sm text-muted-foreground">{t("internal.forbidden")}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t("internal.impersonateOff")}</p>
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("internal.empty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("internal.org")}</th>
                      <th className="px-3 py-2 font-medium">{t("internal.plan")}</th>
                      <th className="px-3 py-2 font-medium">{t("internal.status")}</th>
                      <th className="px-3 py-2 font-medium">{t("internal.users")}</th>
                      <th className="px-3 py-2 font-medium">{t("internal.trialEnds")}</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org) => (
                      <tr key={org.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground">
                            #{org.id} · {org.slug}
                          </div>
                        </td>
                        <td className="px-3 py-2">{org.plan}</td>
                        <td className="px-3 py-2">{org.status}</td>
                        <td className="px-3 py-2">{org.user_count}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {org.status === "suspended" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => setPending(org)}
                            >
                              {t("internal.unsuspend")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => setPending(org)}
                            >
                              {t("internal.suspend")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending?.status === "suspended"
            ? t("internal.unsuspend")
            : t("internal.suspend")
        }
        description={pending ? `${pending.name} (#${pending.id})` : ""}
        destructive={pending?.status !== "suspended"}
        loading={busy}
        onConfirm={() => {
          if (!pending) return;
          void applyStatus(
            pending,
            pending.status === "suspended" ? "active" : "suspended",
          );
        }}
      />
    </div>
  );
}
