"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALES, type Locale } from "@/lib/i18n/types";

export function LanguageSettingsCard() {
  const { locale, setLocale, t } = useLocale();

  async function onChange(next: Locale) {
    await setLocale(next);
    toast.success(t("settings.languageSaved"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.language")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="app-locale">{t("settings.language")}</Label>
        <Select value={locale} onValueChange={(v) => void onChange(v as Locale)}>
          <SelectTrigger id="app-locale" className="w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(`settings.${opt.labelKey}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
