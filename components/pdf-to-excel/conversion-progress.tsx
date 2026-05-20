"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/pdf-converter";

interface ConversionProgressProps {
  status: JobStatus | "idle";
  progress: number;
  logs: string[];
}

export function ConversionProgress({ status, progress, logs }: ConversionProgressProps) {
  const t = useTranslations();

  if (status === "idle") return null;

  const isActive = status === "pending" || status === "processing";
  const isDone = status === "completed";
  const isFailed = status === "failed";

  const steps = [
    { at: 10, label: t("pdfToExcel.progressAnalyze") },
    { at: 35, label: t("pdfToExcel.progressExtract") },
    { at: 70, label: t("pdfToExcel.progressProcess") },
    { at: 90, label: t("pdfToExcel.progressExcel") },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <span className="text-sm font-medium">
            {isFailed
              ? t("pdfToExcel.progressFailed")
              : isDone
                ? t("pdfToExcel.progressDone")
                : t("pdfToExcel.progressRunning")}
          </span>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{progress}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            isFailed ? "bg-destructive" : isDone ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.label}
            className={cn(
              "rounded-lg px-3 py-2 text-xs transition-colors",
              progress >= step.at ? "bg-primary/10 text-primary font-medium" : "bg-muted/50 text-muted-foreground",
            )}
          >
            {step.label}
          </div>
        ))}
      </div>

      {logs.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 bg-slate-950/90 p-3 font-mono text-[11px] leading-relaxed text-emerald-400/90">
          {logs.slice(-12).map((line, i) => (
            <div key={`${i}-${line.slice(0, 20)}`} className="opacity-90">
              <span className="text-slate-500">{"> "}</span>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
