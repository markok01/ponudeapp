import { quoteDisplayStatus, type QuoteStatus } from "@/lib/quote-status";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

const TONE: Record<QuoteStatus, string> = {
  draft: "border-border bg-muted/60 text-muted-foreground",
  sent: "border-transparent bg-primary/10 text-primary",
  accepted: "border-transparent bg-success/12 text-success",
  rejected: "border-transparent bg-destructive/12 text-destructive",
  expired: "border-transparent bg-amber-500/12 text-amber-800 dark:text-amber-200",
};

export function QuoteStatusBadge({
  status,
  validUntil,
  className,
}: {
  status: QuoteStatus;
  validUntil?: string | null;
  className?: string;
}) {
  const t = useTranslations();
  const shown = quoteDisplayStatus({ status, valid_until: validUntil ?? null });

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        TONE[shown],
        className,
      )}
    >
      {t(`quotes.status.${shown}`)}
    </span>
  );
}
