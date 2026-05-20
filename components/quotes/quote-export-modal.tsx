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
  const [showTotalSummary, setShowTotalSummary] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowTotalSummary(false);
    }
  }, [open]);

  async function handleExport() {
    setExporting(true);
    try {
      const settings = await fetchAppSettings();

      await generateQuotePDF(quote, {
        showTotalSummary,
        includeLogo: Boolean(settings.logoDataUrl),
        logoBase64: settings.logoDataUrl,
        companyName: settings.companyName || undefined,
      });

      toast.success("PDF je preuzet");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Generisanje PDF-a nije uspelo",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export PDF ponude</DialogTitle>
          <DialogDescription>
            Prilagodite PDF pre preuzimanja. Logo se postavlja u Podešavanjima.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            PDF sadrži: naziv artikla, mernu jedinicu, cenu bez PDV i cenu sa
            PDV — obe cene sa uračunatim rabatom.
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-border bg-muted/40 px-4 py-3 transition-colors hover:bg-accent/40">
            <input
              type="checkbox"
              checked={showTotalSummary}
              onChange={(e) => setShowTotalSummary(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <span className="text-sm font-medium">
                Prikaži ukupno na dnu PDF-a
              </span>
              <p className="text-xs text-muted-foreground">
                Opciono — ukupan iznos sa PDV ispod tabele.
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
            Otkaži
          </Button>
          <Button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
