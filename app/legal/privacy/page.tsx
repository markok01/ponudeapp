"use client";

import { LegalDocument } from "@/components/marketing/legal-document";
import { useTranslations } from "@/lib/i18n/locale-provider";

const KEYS = [
  "controller",
  "data",
  "hosting",
  "retention",
  "rights",
  "contact",
] as const;

export default function PrivacyPage() {
  const t = useTranslations();
  return (
    <LegalDocument
      title={t("legal.privacyTitle")}
      updated={t("legal.updated")}
      sections={KEYS.map((key) => ({
        heading: t(`legal.privacy.${key}.heading`),
        body: t(`legal.privacy.${key}.body`),
      }))}
    />
  );
}
