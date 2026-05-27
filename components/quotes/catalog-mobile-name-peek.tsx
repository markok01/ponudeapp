"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { Product } from "@/types";
import { formatPdvDisplay, formatPriceHoreca } from "@/utils/catalog-display";
import { useTranslations } from "@/lib/i18n/locale-provider";

type CatalogMobileNamePeekProps = {
  product: Product | null;
  onDismiss?: () => void;
};

/** Puni naziv artikla na uskom ekranu — animirani trak iznad tabele. */
export function CatalogMobileNamePeek({
  product,
  onDismiss,
}: CatalogMobileNamePeekProps) {
  const t = useTranslations();

  return (
    <AnimatePresence mode="wait">
      {product ? (
        <motion.div
          key={product.id}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -12, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="catalog-mobile-name-peek overflow-hidden"
        >
          <div className="mx-2 mb-2 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card to-card px-3 py-2.5 shadow-md">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-primary">
                  {t("catalog.mobilePeekLabel")}
                </p>
                <p className="catalog-mobile-peek-name mt-0.5 text-sm font-semibold leading-snug text-foreground">
                  {product.name}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                  <span>{product.sku}</span>
                  <span className="text-price tabular-nums">
                    {formatPriceHoreca(product.price)}
                  </span>
                  <span>{formatPdvDisplay(product.pdv_percent)}</span>
                </p>
              </div>
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted active:scale-95"
                  aria-label={t("catalog.mobilePeekDismiss")}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
