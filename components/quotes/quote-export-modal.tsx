"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
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
import type { QuoteWithItems } from "@/types";
import { fetchAppSettings } from "@/lib/app-settings";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { generateQuotePDF } from "@/utils/generate-quote-pdf";

export interface QuoteExportModalProps {
  quote: QuoteWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteExportModal({
  quote,
  open,
  onOpenChange,
}: QuoteExportModalProps) {
  const t = useTranslations();
  const [showTotalSummary, setShowTotalSummary] = useState(false);
  const [showMeasureUnit, setShowMeasureUnit] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowTotalSummary(false);
      setShowMeasureUnit(false);
    }
  }, [open]);

  async function handleExport() {
    setExporting(true);
    try {
      const settings = await fetchAppSettings();

      await generateQuotePDF(quote, {
        showTotalSummary,
        showMeasureUnit,
        includeLogo: Boolean(settings.logoDataUrl),
        logoBase64: settings.logoDataUrl,
        companyName: settings.companyName || undefined,
      });

      toast.success(t("quotes.pdfDownloaded"));
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("quotes.pdfFailed"),
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("quotes.exportPdfTitle")}</DialogTitle>
          <DialogDescription>{t("quotes.exportPdfDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t("quotes.exportPdfIncludesLong")}
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-border bg-muted/40 px-4 py-3 transition-colors hover:bg-accent/40">
            <input
              type="checkbox"
              checked={showMeasureUnit}
              onChange={(e) => setShowMeasureUnit(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <span className="text-sm font-medium">{t("quotes.showMeasureUnitPdf")}</span>
              <p className="text-xs text-muted-foreground">
                {t("quotes.measureUnitPdfPlaceholder")}
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-border bg-muted/40 px-4 py-3 transition-colors hover:bg-accent/40">
            <input
              type="checkbox"
              checked={showTotalSummary}
              onChange={(e) => setShowTotalSummary(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <span className="text-sm font-medium">{t("quotes.showTotalPdf")}</span>
              <p className="text-xs text-muted-foreground">
                {t("quotes.totalPdfPlaceholder")}
              </p>
            </div>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("quotes.exportPdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
