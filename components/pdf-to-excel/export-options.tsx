"use client";

import { cn } from "@/lib/utils";
import type { ExportMode } from "@/types/pdf-converter";

const OPTIONS: { value: ExportMode; title: string; description: string }[] = [
  {
    value: "multiple_sheets",
    title: "Više sheetova",
    description: "Svaka detektovana tabela u poseban Excel sheet",
  },
  {
    value: "single_sheet",
    title: "Jedan sheet",
    description: "Sve tabele spojene u jedan sheet sa separatorima",
  },
  {
    value: "combined",
    title: "Combined",
    description: "Tabele sa istom strukturom kolona spojene u grupe",
  },
];

interface ExportOptionsProps {
  value: ExportMode;
  onChange: (mode: ExportMode) => void;
  disabled?: boolean;
}

export function ExportOptions({ value, onChange, disabled }: ExportOptionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((opt) => (
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
