"use client";

import { useEffect, useState } from "react";
import { Archive, Check, Loader2, Pencil, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { fetchAppSettings } from "@/lib/app-settings";
import { defaultCurrencyForLocale, normalizeCurrency, type Currency } from "@/lib/currency";
import { CurrencySelect } from "@/components/ui/currency-select";
import type { PriceListRecord, PriceListTemplate } from "@/types";

export function PriceListSwitcher({
  lists,
  selectedId,
  onSelect,
  onChanged,
}: {
  lists: PriceListRecord[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onChanged: (selectId?: number) => void;
}) {
  const t = useTranslations();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<PriceListTemplate>("horeca");
  const [currency, setCurrency] = useState<Currency>("RSD");
  const [makeActive, setMakeActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const selected = lists.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    if (renameOpen && selected) {
      setName(selected.name);
      setCurrency(normalizeCurrency(selected.currency));
    }
  }, [renameOpen, selected]);

  async function createList() {
    setBusy(true);
    try {
      const res = await fetch("/api/price-lists", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || t("lists.defaultName"),
          template,
          active: makeActive,
          currency,
        }),
      });
      const data = (await res.json()) as PriceListRecord & {
        error?: string;
        redirect?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("lists.createFailed"));
      toast.success(t("lists.created"));
      setCreateOpen(false);
      setName("");
      onChanged(data.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("lists.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function renameList() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/price-lists/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("lists.renameFailed"));
      toast.success(t("lists.renamed"));
      setRenameOpen(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("lists.renameFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function setActive() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/price-lists/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("lists.activateFailed"));
      toast.success(t("lists.activated"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("lists.activateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function archiveList() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/price-lists/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("lists.archiveFailed"));
      toast.success(t("lists.archived"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("lists.archiveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {lists.length > 0 ? (
      <Select
        value={selectedId ? String(selectedId) : undefined}
        onValueChange={(v) => onSelect(Number(v))}
      >
        <SelectTrigger className="sm:w-64">
          <SelectValue placeholder={t("lists.select")} />
        </SelectTrigger>
        <SelectContent>
          {lists.map((list) => (
            <SelectItem key={list.id} value={String(list.id)}>
              {list.name}
              {list.active ? ` · ${t("lists.activeBadge")}` : ""}
              {` · ${normalizeCurrency(list.currency)}`}
              {` · ${list.product_count}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => {
          setName("");
          setTemplate("horeca");
          setMakeActive(true);
          setCreateOpen(true);
          void fetchAppSettings().then((s) =>
            setCurrency(normalizeCurrency(s.currency) || defaultCurrencyForLocale(s.locale)),
          );
        }}>
          <Plus className="h-4 w-4" />
          {t("lists.new")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected}
          onClick={() => setRenameOpen(true)}
        >
          <Pencil className="h-4 w-4" />
          {t("common.edit")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected || selected.active}
          onClick={() => void setActive()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
          {t("lists.setActive")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!selected || lists.length < 2}
          onClick={() => void archiveList()}
        >
          <Archive className="h-4 w-4" />
          {t("lists.archive")}
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("lists.newTitle")}</DialogTitle>
            <DialogDescription>{t("lists.newHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">{t("lists.name")}</Label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("lists.defaultName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-currency">{t("lists.currency")}</Label>
              <CurrencySelect
                id="list-currency"
                value={currency}
                onChange={setCurrency}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("lists.templateLabel")}</Label>
              <div className="grid gap-2">
                {(["empty", "simple", "horeca"] as PriceListTemplate[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      template === key ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => setTemplate(key)}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {template === key ? <Check className="h-3.5 w-3.5" /> : null}
                      {t(`lists.template.${key}`)}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t(`lists.templateHint.${key}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
              />
              <span>{t("lists.setActive")}</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void createList()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("lists.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("lists.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-list">{t("lists.name")}</Label>
              <Input
                id="rename-list"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-currency">{t("lists.currency")}</Label>
              <CurrencySelect
                id="rename-currency"
                value={currency}
                onChange={setCurrency}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void renameList()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
