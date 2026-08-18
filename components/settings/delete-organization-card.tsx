"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n/locale-provider";

export function DeleteOrganizationCard() {
  const t = useTranslations();
  const [isOwner, setIsOwner] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: { role?: string }; organization?: { name?: string } }) => {
        setIsOwner(d.user?.role === "owner");
        setOrgName(d.organization?.name ?? "");
      })
      .catch(() => undefined);
  }, []);

  if (!isOwner) return null;

  async function confirmDelete() {
    if (typed.trim().toLowerCase() !== orgName.trim().toLowerCase()) {
      toast.error(t("danger.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/org", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: typed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("danger.failed"));
      toast.success(t("danger.deleted"));
      window.location.assign("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("danger.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t("danger.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("danger.help")}</p>
          <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
            {t("danger.button")}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            setTyped("");
          }
        }}
        title={t("danger.confirmTitle")}
        description={
          <div className="space-y-3">
            <p>{t("danger.confirmBody", { name: orgName })}</p>
            <div className="space-y-2">
              <Label htmlFor="delete-org-name">{t("danger.confirmLabel")}</Label>
              <Input
                id="delete-org-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        }
        confirmLabel={busy ? t("common.loading") : t("danger.confirmAction")}
        destructive
        loading={busy}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
