"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAppSettings, persistAppSettings } from "@/lib/app-settings";
import {
  applyCatalogThemeToDocument,
  CATALOG_THEME_DEFAULT,
  CATALOG_THEME_PRESETS,
  CATALOG_THEME_SILBO,
  normalizeCatalogColors,
  resolveCatalogTheme,
} from "@/lib/catalog-theme";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { CatalogColorPalette, CatalogThemePreset } from "@/types";

const COLOR_FIELDS: {
  key: keyof CatalogColorPalette;
  labelKey: string;
}[] = [
  { key: "brandBg", labelKey: "settings.catalogColorBrandBg" },
  { key: "brandText", labelKey: "settings.catalogColorBrandText" },
  { key: "headerBg", labelKey: "settings.catalogColorHeaderBg" },
  { key: "headerText", labelKey: "settings.catalogColorHeaderText" },
  { key: "price", labelKey: "settings.catalogColorPrice" },
  { key: "priceTotal", labelKey: "settings.catalogColorPriceTotal" },
];

function ThemePreview({ colors }: { colors: CatalogColorPalette }) {
  const t = useTranslations();
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-border text-[11px]">
      <div
        className="px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: colors.brandBg, color: colors.brandText }}
      >
        {t("settings.catalogPreviewBrand")}
      </div>
      <div
        className="grid grid-cols-3 gap-px border-b border-border/60 px-2 py-1.5 font-medium"
        style={{ background: colors.headerBg, color: colors.headerText }}
      >
        <span>{t("catalog.sku")}</span>
        <span>{t("quotes.name")}</span>
        <span className="text-right">Cena</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-card px-2 py-1.5">
        <span className="text-muted-foreground">1001</span>
        <span>Primer artikla</span>
        <span className="text-right font-semibold tabular-nums" style={{ color: colors.price }}>
          1.250,00
        </span>
      </div>
      <div className="flex justify-end border-t border-border/60 bg-muted/30 px-2 py-1.5">
        <span className="font-semibold tabular-nums" style={{ color: colors.priceTotal }}>
          1.250,00
        </span>
      </div>
    </div>
  );
}

export function CatalogThemeSettingsCard() {
  const t = useTranslations();
  const [preset, setPreset] = useState<CatalogThemePreset>("default");
  const [colors, setColors] = useState<CatalogColorPalette>({
    ...CATALOG_THEME_DEFAULT,
  });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const resolved = resolveCatalogTheme(preset, colors);

  useEffect(() => {
    void fetchAppSettings().then((settings) => {
      setPreset(settings.catalogThemePreset);
      setColors(normalizeCatalogColors(settings.catalogColors));
      applyCatalogThemeToDocument(
        resolveCatalogTheme(settings.catalogThemePreset, settings.catalogColors),
      );
      setReady(true);
    });
  }, []);

  async function save(
    nextPreset: CatalogThemePreset,
    nextColors: CatalogColorPalette,
  ) {
    setSaving(true);
    try {
      const saved = await persistAppSettings({
        catalogThemePreset: nextPreset,
        catalogColors: nextColors,
      });
      const theme = resolveCatalogTheme(
        saved.catalogThemePreset,
        saved.catalogColors,
      );
      applyCatalogThemeToDocument(theme);
      setPreset(saved.catalogThemePreset);
      setColors(normalizeCatalogColors(saved.catalogColors));
      toast.success(t("settings.catalogThemeSaved"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function selectPreset(next: CatalogThemePreset) {
    const nextColors =
      next === "custom"
        ? colors
        : { ...CATALOG_THEME_PRESETS[next] };
    setPreset(next);
    if (next !== "custom") setColors(nextColors);
    applyCatalogThemeToDocument(resolveCatalogTheme(next, nextColors));
    void save(next, next === "custom" ? colors : nextColors);
  }

  function onColorChange(key: keyof CatalogColorPalette, value: string) {
    const base = resolveCatalogTheme(preset, colors);
    const next = normalizeCatalogColors({ ...base, [key]: value });
    setPreset("custom");
    setColors(next);
    applyCatalogThemeToDocument(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-1.5">
          {t("settings.catalogThemeTitle")}
          <InfoHint text={t("help.catalogTheme")} label={t("help.aria")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {t("settings.catalogThemeHelp")}
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              { id: "default", label: t("settings.catalogThemeDefault"), swatch: CATALOG_THEME_DEFAULT },
              { id: "silbo", label: t("settings.catalogThemeSilbo"), swatch: CATALOG_THEME_SILBO },
              { id: "custom", label: t("settings.catalogThemeCustom"), swatch: colors },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={!ready || saving}
              onClick={() => selectPreset(opt.id)}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors",
                preset === opt.id
                  ? "border-foreground/30 bg-muted/50"
                  : "border-border hover:bg-muted/30",
              )}
            >
              <div className="mb-2 flex gap-1">
                <span
                  className="h-4 flex-1 rounded-sm"
                  style={{ background: opt.swatch.brandBg }}
                />
                <span
                  className="h-4 flex-1 rounded-sm"
                  style={{ background: opt.swatch.headerBg }}
                />
                <span
                  className="h-4 flex-1 rounded-sm"
                  style={{ background: opt.swatch.price }}
                />
              </div>
              <p className="text-xs font-medium">{opt.label}</p>
            </button>
          ))}
        </div>

        <ThemePreview colors={resolved} />

        <div className="grid gap-3 sm:grid-cols-2">
          {COLOR_FIELDS.map(({ key, labelKey }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`catalog-color-${key}`} className="text-xs">
                {t(labelKey)}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id={`catalog-color-${key}`}
                  type="color"
                  value={resolved[key]}
                  disabled={!ready || saving}
                  onChange={(e) => onColorChange(key, e.target.value)}
                  className="h-9 w-11 cursor-pointer rounded border border-input bg-card p-1"
                />
                  <Input
                    value={resolved[key]}
                    disabled={!ready || saving}
                    onChange={(e) => onColorChange(key, e.target.value)}
                    className="font-mono text-xs uppercase"
                    maxLength={7}
                  />
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          disabled={!ready || saving}
          onClick={() =>
            void save(preset, normalizeCatalogColors(preset === "custom" ? colors : resolved))
          }
        >
          {saving ? t("common.loading") : t("settings.catalogThemeSave")}
        </Button>

        {!ready ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
