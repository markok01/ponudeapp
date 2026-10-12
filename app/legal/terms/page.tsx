"use client";

import { LegalDocument } from "@/components/marketing/legal-document";
import { useTranslations } from "@/lib/i18n/locale-provider";

const KEYS = [
  "service",
  "subscription",
  "vat",
  "dataRole",
  "liability",
  "cancel",
  "law",
] as const;

export default function TermsPage() {
  const t = useTranslations();
  return (
    <LegalDocument
      title={t("legal.termsTitle")}
      updated={t("legal.updated")}
      sections={KEYS.map((key) => ({
        heading: t(`legal.terms.${key}.heading`),
        body: t(`legal.terms.${key}.body`),
      }))}
    />
  );
}
