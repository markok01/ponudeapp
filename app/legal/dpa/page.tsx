"use client";

import { LegalDocument } from "@/components/marketing/legal-document";
import { useTranslations } from "@/lib/i18n/locale-provider";

const KEYS = [
  "parties",
  "scope",
  "instructions",
  "security",
  "subprocessors",
  "assistance",
  "law",
] as const;

export default function DpaPage() {
  const t = useTranslations();
  return (
    <LegalDocument
      title={t("legal.dpaTitle")}
      updated={t("legal.updated")}
      sections={KEYS.map((key) => ({
        heading: t(`legal.dpa.${key}.heading`),
        body: t(`legal.dpa.${key}.body`),
      }))}
    />
  );
}
