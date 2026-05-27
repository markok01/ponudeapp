"use client";

import { useEffect } from "react";
import { useContainerWidth } from "@/hooks/use-container-width";
import { isFluidCatalogPanel } from "@/lib/catalog-table-layout";
import { cn } from "@/lib/utils";

type CatalogTableShellProps = {
  children: React.ReactNode;
  className?: string;
  onWidthChange?: (width: number) => void;
  scrollHint?: React.ReactNode;
  maxHeightClass?: string;
  /** U quote workspace-u panel već ima svoj scroll. */
  scrollBodyClass?: string;
};

/** Wrapper sa @container i merenjem širine za responsive scale. */
export function CatalogTableShell({
  children,
  className,
  onWidthChange,
  scrollHint,
  maxHeightClass = "max-h-[min(calc(100dvh-12rem),560px)] overflow-x-auto overflow-y-auto overscroll-contain max-md:touch-pan-x sm:max-h-[min(58vh,520px)] lg:max-h-[min(68vh,640px)]",
  scrollBodyClass,
}: CatalogTableShellProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();

  useEffect(() => {
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  const fluid = isFluidCatalogPanel(width);

  return (
    <div
      ref={ref}
      className={cn(
        "@container catalog-scroll-wrap min-w-0 overflow-hidden rounded-[var(--radius)] border border-border bg-card/50 shadow-[var(--shadow-soft)]",
        className,
      )}
      data-catalog-fluid={fluid ? "true" : "false"}
      style={
        {
          "--catalog-panel-w": width > 0 ? `${width}px` : "100%",
        } as React.CSSProperties
      }
    >
      {scrollHint}
      <div className={scrollBodyClass ?? maxHeightClass}>{children}</div>
    </div>
  );
}
