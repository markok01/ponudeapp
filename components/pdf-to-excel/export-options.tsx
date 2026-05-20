"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { ExportMode } from "@/types/pdf-converter";

interface ExportOptionsProps {
  value: ExportMode;
  onChange: (mode: ExportMode) => void;
  disabled?: boolean;
}

export function ExportOptions({ value, onChange, disabled }: ExportOptionsProps) {
  const t = useTranslations();

  const options = [
    {
      value: "single_sheet" as const,
      title: t("pdfToExcel.singleSheet"),
      description: t("pdfToExcel.singleSheetDesc"),
    },
    {
      value: "multiple_sheets" as const,
      title: t("pdfToExcel.multiSheet"),
      description: t("pdfToExcel.multiSheetDesc"),
    },
    {
      value: "combined" as const,
      title: t("pdfToExcel.combined"),
      description: t("pdfToExcel.combinedDesc"),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-xl border p-4 text-left transition-all duration-200",
            value === opt.value
              ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/30"
              : "border-border/60 bg-white/40 hover:border-primary/30 hover:bg-white/60",
            disabled && "opacity-60",
          )}
        >
          <p className="text-sm font-semibold">{opt.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
        </button>
      ))}
    </div>
  );
}
