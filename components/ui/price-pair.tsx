import { formatCurrency } from "@/utils/format";
import { unitPriceWithPdv } from "@/utils/prices";
import { cn } from "@/lib/utils";

interface PricePairProps {
  netPrice: number;
  pdvPercent: number;
  className?: string;
  align?: "left" | "right";
}

export function PricePair({
  netPrice,
  pdvPercent,
  className,
  align = "right",
}: PricePairProps) {
  const gross = unitPriceWithPdv(netPrice, pdvPercent);
  return (
    <div
      className={cn(
        "space-y-1 text-sm leading-tight tabular-nums",
        align === "right" && "text-right",
        className,
      )}
    >
      <p className="text-muted-foreground">
        <span className="text-[10px] font-medium uppercase tracking-wider">
          bez PDV
        </span>
        <br />
        <span className="text-price text-[13px]">{formatCurrency(netPrice)}</span>
      </p>
      <p>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          sa PDV
        </span>
        <br />
        <span className="text-price-total text-[14px]">{formatCurrency(gross)}</span>
      </p>
    </div>
  );
}
