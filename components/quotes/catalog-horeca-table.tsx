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
    <div className="catalog-scroll-wrap min-w-0 overflow-hidden rounded-[var(--radius)] border border-border bg-card/50 shadow-[var(--shadow-soft)] max-md:mx-0.5">
      <p className="scroll-hint-label hidden px-3 pt-2 sm:px-4 md:block">Prevucite tabelu ulevo/desno →</p>
      <HorizontalScroll hint={false}>
        <div className="max-h-[min(62vh,520px)] overflow-y-auto overscroll-y-contain sm:max-h-[min(72vh,680px)] xl:max-h-[min(78vh,780px)]">
        <table className="catalog-table w-full border-collapse text-sm md:min-w-[520px]">
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
          className="border border-border/40 px-2 py-2 text-center text-xs font-bold uppercase tracking-wide sm:px-3 sm:py-2.5 sm:text-sm"
        >
          {groupLabel}
        </td>
      </tr>
      <tr className={HORECA_HEADER_BG}>
        <th className="catalog-col-sku catalog-cell w-[100px] border border-border/50 text-center font-bold max-md:w-auto md:px-2 md:py-2 md:text-xs">
          šifra
        </th>
        <th className="catalog-col-name catalog-cell border border-border/50 text-left font-bold max-md:w-auto md:px-2 md:py-2 md:text-xs">
          artikal
        </th>
        <th className="catalog-col-price catalog-cell w-[130px] border border-border/50 text-right font-bold tabular-nums max-md:w-auto md:px-2 md:py-2 md:text-xs">
          p.c.
        </th>
        <th className="catalog-col-pdv catalog-cell w-[56px] border border-border/50 text-center font-bold max-md:w-auto md:px-2 md:py-2 md:text-xs">
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
            <td className="catalog-col-sku catalog-cell border border-border/40 font-mono text-muted-foreground max-md:px-1 md:px-2 md:py-2 md:text-xs">
              {product.sku}
            </td>
            <td className="catalog-col-name catalog-cell border border-border/40 text-left font-medium max-md:px-1 md:px-2 md:py-2 md:text-sm md:leading-snug">
              <span className="catalog-cell-name">{product.name}</span>
            </td>
            <td className="catalog-col-price catalog-cell catalog-cell-price border border-border/40 text-right font-mono tabular-nums text-price max-md:px-0.5 md:px-2 md:py-2 md:text-sm">
              {formatPriceHoreca(product.price)}
            </td>
            <td className="catalog-col-pdv catalog-cell border border-border/40 text-center text-muted-foreground max-md:px-0.5 md:px-2 md:py-2 md:text-sm">
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
