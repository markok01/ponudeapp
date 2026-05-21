"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useTranslations } from "@/lib/i18n/locale-provider";

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

export function AdminUsersPanel() {
  const t = useTranslations();
  const adminAccess = useIsAdmin();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) {
        setUsers([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("settings.accountCreated", { email: data.email }));
      setForm({ email: "", password: "", name: "" });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          {t("settings.usersTitle")}
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
                  {u.email} · {u.role}
                  {!u.active ? ` · ${t("settings.deactivated")}` : ""}
                </p>
              </div>
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
            </li>
          ))}
        </ul>

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

        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4 border-t pt-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="h-4 w-4" />
            {t("settings.addUser")}
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-password">{t("settings.userPassword")}</Label>
              <PasswordInput
                id="admin-password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.usersAppOnlyRole")}</p>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("settings.createAccount")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
