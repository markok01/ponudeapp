"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useTranslations } from "@/lib/i18n/locale-provider";

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

interface InviteRow {
  id: number;
  email: string;
  name: string;
  role: string;
  expires_at: string;
}

function roleLabel(
  role: string,
  t: (key: string) => string,
): string {
  if (role === "owner") return t("settings.userRoleOwner");
  if (role === "admin") return t("settings.userRoleAdmin");
  return t("settings.userRoleUser");
}

export function AdminUsersPanel() {
  const t = useTranslations();
  const adminAccess = useIsAdmin();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "user" as "admin" | "user",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, invitesRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/invites"),
      ]);
      if (usersRes.status === 403) {
        setUsers([]);
        setInvites([]);
        return;
      }
      const usersData = await usersRes.json();
      const invitesData = await invitesRes.json();
      if (!usersRes.ok) throw new Error(usersData.error);
      if (!invitesRes.ok) throw new Error(invitesData.error);
      setUsers(usersData);
      setInvites(invitesData);
    } catch {
      toast.error(t("settings.usersLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (adminAccess !== "admin") return;
    void load();
  }, [adminAccess, load]);

  if (adminAccess !== "admin") return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.delivered
          ? t("settings.inviteSent", { email: data.email })
          : t("settings.inviteLogged", { email: data.email }),
      );
      setForm({ email: "", name: "", role: "user" });
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: number) {
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("settings.accountDeactivated"));
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }

  async function removeUser(id: number) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?id=${id}&permanent=1`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("settings.accountDeleted"));
      setDeleteTarget(null);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  async function revokeInvite(id: number) {
    try {
      const res = await fetch(`/api/admin/invites?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("settings.inviteRevoked"));
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          <span className="inline-flex items-center gap-1.5">
            {t("settings.usersTitle")}
            <InfoHint text={t("help.members")} label={t("help.aria")} />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("settings.usersHelp")}</p>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{u.name || u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {u.email} · {roleLabel(u.role, t)}
                  {!u.active ? ` · ${t("settings.deactivated")}` : ""}
                </p>
              </div>
              {u.role !== "owner" ? (
                <div className="flex flex-wrap gap-2">
                  {u.active ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void deactivate(u.id)}
                    >
                      {t("settings.deactivate")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("settings.deleteUser")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {invites.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("settings.pendingInvites")}</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel(inv.role, t)} · {t("settings.invitePending")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void revokeInvite(inv.id)}
                  >
                    {t("settings.inviteRevoke")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title={t("settings.deleteUserTitle")}
          description={t("settings.deleteUserBody", {
            email: deleteTarget?.email ?? "",
          })}
          confirmLabel={t("settings.deleteUser")}
          destructive
          loading={deleting}
          onConfirm={() => {
            if (deleteTarget) void removeUser(deleteTarget.id);
          }}
        />

        <form onSubmit={(e) => void handleInvite(e)} className="space-y-4 border-t pt-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="h-4 w-4" />
            {t("settings.inviteUser")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-email">{t("auth.email")}</Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-name">{t("settings.userName")}</Label>
              <Input
                id="admin-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.userRole")}</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm({ ...form, role: value === "admin" ? "admin" : "user" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("settings.userRoleUser")}</SelectItem>
                  <SelectItem value="admin">{t("settings.userRoleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.inviteHelp")}</p>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {t("settings.sendInvite")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
