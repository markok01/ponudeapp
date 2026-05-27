"use client";

import { useRef } from "react";
import { useQuotePanelSplitDrag } from "@/hooks/use-quote-panel-split-drag";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import {
  QuoteWorkspaceMobileTabs,
  type QuoteWorkspaceMobileTab,
} from "@/components/quotes/quote-workspace-mobile-tabs";
import { cn } from "@/lib/utils";

export function QuoteWorkspaceSplit({
  catalog,
  quote,
  className,
  mobileTab,
  onMobileTabChange,
  quoteLineCount = 0,
}: {
  catalog: React.ReactNode;
  quote: React.ReactNode;
  className?: string;
  mobileTab: QuoteWorkspaceMobileTab;
  onMobileTabChange: (tab: QuoteWorkspaceMobileTab) => void;
  quoteLineCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { layout, setCatalogPanelPct, setPanelResizing, reportLivePanelWidths } =
    useQuoteWorkspaceLayout();

  const { onPointerDown } = useQuotePanelSplitDrag({
    containerRef,
    catalogPanelPct: layout.catalogPanelPct,
    onCommit: setCatalogPanelPct,
    onResizingChange: setPanelResizing,
    onLiveWidths: reportLivePanelWidths,
  });

  return (
    <div
      className={cn(
        "quote-workspace-split flex min-h-0 flex-1 flex-col gap-2 overflow-hidden max-lg:min-h-0 max-lg:basis-0",
        className,
      )}
    >
      <QuoteWorkspaceMobileTabs
        active={mobileTab}
        onChange={onMobileTabChange}
        quoteLineCount={quoteLineCount}
      />
      <div
        ref={containerRef}
        data-mobile-tab={mobileTab}
        className={cn(
          "quote-workspace-panels quote-workspace-panels--tabs relative flex min-h-0 flex-1 flex-col overflow-hidden sm:gap-0",
          "max-lg:min-h-[min(52dvh,calc(100dvh-13.5rem))] max-lg:flex-1",
          "lg:grid lg:grid-cols-[var(--catalog-panel-pct)_0.75rem_minmax(0,1fr)] lg:grid-rows-1 lg:items-stretch lg:gap-0 lg:min-h-0",
        )}
        style={
          {
            "--catalog-panel-pct": `${layout.catalogPanelPct}%`,
          } as React.CSSProperties
        }
      >
        <section
          data-catalog-panel
          className="quote-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border/80 bg-card shadow-[var(--shadow-soft)] max-lg:min-h-0 max-lg:flex-1 max-lg:basis-0 lg:min-w-0 lg:rounded-r-none lg:border-r-0"
        >
          <div className="quote-panel-inner flex min-h-0 flex-1 flex-col">{catalog}</div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(layout.catalogPanelPct)}
          aria-valuemin={22}
          aria-valuemax={68}
          title="Prevuci levo-desno"
          onPointerDown={onPointerDown}
          className="quote-panel-split group relative z-10 hidden w-3 shrink-0 cursor-col-resize touch-none select-none items-stretch justify-center bg-border/30 hover:bg-primary/25 active:bg-primary/45 lg:flex"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-2 -right-2"
          />
          <span className="pointer-events-none my-auto h-14 w-1 rounded-full bg-border shadow-sm transition-colors group-hover:bg-primary/70 group-active:bg-primary" />
        </div>

        <section
          data-quote-panel
          className="quote-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border/80 bg-card shadow-[var(--shadow-soft)] max-lg:min-h-0 max-lg:flex-1 max-lg:basis-0 lg:min-w-0 lg:justify-self-stretch lg:rounded-l-none"
        >
          <div className="quote-panel-inner flex min-h-0 flex-1 flex-col">{quote}</div>
        </section>
      </div>
    </div>
  );
}
