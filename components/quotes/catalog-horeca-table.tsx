"use client";

import { Check, Plus } from "lucide-react";
import type { Product } from "@/types";
import {
  formatPdvDisplay,
  formatPriceHoreca,
  groupProductsByCategory,
  HORECA_BRAND_BG,
  HORECA_HEADER_BG,
} from "@/utils/catalog-display";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { cn } from "@/lib/utils";

interface CatalogHorecaTableProps {
  products: Product[];
  inQuoteIds: Set<number>;
  activeProductId: number | null;
  onSelect: (product: Product) => void;
}

export function CatalogHorecaTable({
  products,
  inQuoteIds,
  activeProductId,
  onSelect,
}: CatalogHorecaTableProps) {
  const groups = groupProductsByCategory(products);

  if (!products.length) {
    return null;
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-[var(--radius)] border border-border bg-card/50 shadow-[var(--shadow-soft)]">
      <p className="scroll-hint-label px-3 pt-2 sm:px-4">Prevucite tabelu ulevo/desno →</p>
      <HorizontalScroll>
        <div className="max-h-[min(62vh,520px)] overflow-y-auto overscroll-y-contain sm:max-h-[min(72vh,680px)] xl:max-h-[min(78vh,780px)]">
        <table className="w-full min-w-[28rem] border-collapse text-sm sm:min-w-[520px]">
          <tbody>
            {groups.map((group) => (
              <GroupBlock
                key={group.groupLabel}
                groupLabel={group.groupLabel}
                products={group.products}
                inQuoteIds={inQuoteIds}
                activeProductId={activeProductId}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
        </div>
      </HorizontalScroll>
    </div>
  );
}

function GroupBlock({
  groupLabel,
  products,
  inQuoteIds,
  activeProductId,
  onSelect,
}: {
  groupLabel: string;
  products: Product[];
  inQuoteIds: Set<number>;
  activeProductId: number | null;
  onSelect: (product: Product) => void;
}) {
  return (
    <>
      <tr className={HORECA_BRAND_BG}>
        <td
          colSpan={4}
          className="border border-border/40 px-3 py-2.5 text-center text-sm font-bold uppercase tracking-wide"
        >
          {groupLabel}
        </td>
      </tr>
      <tr className={HORECA_HEADER_BG}>
        <th className="w-[100px] border border-border/50 px-2 py-2 text-center text-xs font-bold">
          šifra
        </th>
        <th className="border border-border/50 px-2 py-2 text-left text-xs font-bold">
          artikal
        </th>
        <th className="w-[130px] border border-border/50 px-2 py-2 text-right text-xs font-bold tabular-nums">
          p.c.
        </th>
        <th className="w-[56px] border border-border/50 px-2 py-2 text-center text-xs font-bold">
          PDV
        </th>
      </tr>
      {products.map((product, index) => {
        const inQuote = inQuoteIds.has(product.id);
        const isActive = activeProductId === product.id;

        return (
          <tr
            key={product.id}
            className={cn(
              "cursor-pointer transition-all duration-150",
              index % 2 === 0 ? "bg-card" : "bg-muted/30",
              isActive &&
                "bg-primary/15 ring-2 ring-inset ring-primary shadow-sm",
              !isActive && inQuote && "bg-emerald-50/90",
              !isActive &&
                !inQuote &&
                "hover:bg-primary/8 hover:ring-1 hover:ring-inset hover:ring-primary/40",
            )}
            onClick={() => onSelect(product)}
          >
            <td className="border border-border/40 px-2 py-2 font-mono text-xs text-muted-foreground">
              {product.sku}
            </td>
            <td className="border border-border/40 px-2 py-2 text-left text-sm font-medium leading-snug">
              {product.name}
            </td>
            <td className="border border-border/40 px-2 py-2 text-right font-mono text-sm tabular-nums text-price whitespace-nowrap">
              {formatPriceHoreca(product.price)}
            </td>
            <td className="border border-border/40 px-2 py-2 text-center text-sm text-muted-foreground">
              {formatPdvDisplay(product.pdv_percent)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

export function CatalogSelectionHint({
  activeProduct,
  inQuoteCount,
}: {
  activeProduct: Product | null;
  inQuoteCount: number;
}) {
  if (!activeProduct && inQuoteCount === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Kliknite red u cenovniku da dodate stavku u ponudu
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
      {activeProduct ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
          <Plus className="h-3 w-3" />
          Poslednji izbor: {activeProduct.sku}
        </span>
      ) : null}
      {inQuoteCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
          <Check className="h-3 w-3" />
          {inQuoteCount} u ponudi
        </span>
      ) : null}
    </div>
  );
}
