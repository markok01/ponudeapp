"use client";

import { useRef } from "react";
import { usePointerDrag } from "@/hooks/use-pointer-drag";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import { cn } from "@/lib/utils";

export function QuoteWorkspaceSplit({
  catalog,
  quote,
  className,
}: {
  catalog: React.ReactNode;
  quote: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { layout, resizeCatalogPanelByDelta } = useQuoteWorkspaceLayout();

  const { onPointerDown } = usePointerDrag("x", (delta) => {
    const w = containerRef.current?.getBoundingClientRect().width ?? 0;
    resizeCatalogPanelByDelta(delta, w);
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "quote-workspace-panels flex min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-0 lg:flex-row lg:gap-0",
        className,
      )}
      style={
        {
          "--catalog-panel-pct": `${layout.catalogPanelPct}%`,
        } as React.CSSProperties
      }
    >
      <section
        data-catalog-panel
        className="quote-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-border/80 bg-card shadow-[var(--shadow-soft)] lg:flex-[0_0_var(--catalog-panel-pct)] lg:rounded-r-none lg:border-r-0"
      >
        <div className="flex h-full min-h-0 flex-col">{catalog}</div>
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(layout.catalogPanelPct)}
        title="Prevuci levo-desno"
        onPointerDown={onPointerDown}
        className="quote-panel-split hidden w-2 shrink-0 cursor-col-resize touch-none items-stretch justify-center bg-border/40 hover:bg-primary/30 active:bg-primary/50 lg:flex"
      >
        <span className="my-auto h-12 w-0.5 rounded-full bg-border" />
      </div>

      <section
        data-quote-panel
        className="quote-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-border/80 bg-card shadow-[var(--shadow-soft)] lg:rounded-l-none"
      >
        <div className="flex h-full min-h-0 flex-col">{quote}</div>
      </section>
    </div>
  );
}
