"use client";

import { useCallback, useEffect, useRef } from "react";
import { clamp, QUOTE_LAYOUT_LIMITS } from "@/lib/quote-workspace-layout";

type UseQuotePanelSplitDragOptions = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  catalogPanelPct: number;
  onCommit: (pct: number) => void;
  onResizingChange?: (resizing: boolean) => void;
  /** Širine panela za live proračun kolona u tabelama (jednom po kadru). */
  onLiveWidths?: (catalogPx: number, quotePx: number) => void;
};

function clampPanelPct(pct: number): number {
  return clamp(
    pct,
    QUOTE_LAYOUT_LIMITS.catalogPanelPct.min,
    QUOTE_LAYOUT_LIMITS.catalogPanelPct.max,
  );
}

function pctFromPointer(clientX: number, rect: DOMRect): number {
  const pct = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  return clampPanelPct(pct);
}

function measurePanelWidths(container: HTMLElement): {
  catalog: number;
  quote: number;
} {
  const catalogEl = container.querySelector<HTMLElement>("[data-catalog-panel]");
  const quoteEl = container.querySelector<HTMLElement>("[data-quote-panel]");
  return {
    catalog: Math.round(catalogEl?.getBoundingClientRect().width ?? 0),
    quote: Math.round(quoteEl?.getBoundingClientRect().width ?? 0),
  };
}

/**
 * Live resize: paneli + tabele se preračunavaju tokom prevlačenja.
 * CSS var se menja svaki kadar (rAF); React širine batch-ovano preko onLiveWidths.
 */
export function useQuotePanelSplitDrag({
  containerRef,
  catalogPanelPct,
  onCommit,
  onResizingChange,
  onLiveWidths,
}: UseQuotePanelSplitDragOptions) {
  const draggingRef = useRef(false);
  const latestClientXRef = useRef(0);
  const currentPctRef = useRef(catalogPanelPct);
  const rafRef = useRef<number | null>(null);
  const onLiveWidthsRef = useRef(onLiveWidths);
  onLiveWidthsRef.current = onLiveWidths;

  const applyLiveLayout = useCallback(() => {
    rafRef.current = null;
    if (!draggingRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    const pct = pctFromPointer(latestClientXRef.current, rect);
    currentPctRef.current = pct;
    container.style.setProperty("--catalog-panel-pct", `${pct}%`);

    // Merenje posle layout-a (sledeći kadar) — kolone prate stvarnu širinu panela.
    requestAnimationFrame(() => {
      if (!draggingRef.current) return;
      const { catalog, quote } = measurePanelWidths(container);
      onLiveWidthsRef.current?.(catalog, quote);
    });
  }, [containerRef]);

  const scheduleFrame = useCallback(
    (clientX: number) => {
      latestClientXRef.current = clientX;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(applyLiveLayout);
    },
    [applyLiveLayout],
  );

  const syncPctToDom = useCallback(
    (pct: number) => {
      const clamped = clampPanelPct(pct);
      currentPctRef.current = clamped;
      containerRef.current?.style.setProperty(
        "--catalog-panel-pct",
        `${clamped}%`,
      );
    },
    [containerRef],
  );

  useEffect(() => {
    if (!draggingRef.current) {
      syncPctToDom(catalogPanelPct);
    }
  }, [catalogPanelPct, syncPctToDom]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      draggingRef.current = true;
      latestClientXRef.current = e.clientX;
      currentPctRef.current = catalogPanelPct;
      onResizingChange?.(true);

      container.dataset.panelResizing = "true";
      syncPctToDom(catalogPanelPct);
      scheduleFrame(e.clientX);

      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.classList.add("quote-panel-drag-active");
    },
    [
      catalogPanelPct,
      containerRef,
      onResizingChange,
      scheduleFrame,
      syncPctToDom,
    ],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      scheduleFrame(e.clientX);
    };

    const endDrag = (e?: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      if (e) {
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          currentPctRef.current = pctFromPointer(e.clientX, rect);
        }
      }

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const container = containerRef.current;
      if (container) {
        delete container.dataset.panelResizing;
        syncPctToDom(currentPctRef.current);
        const { catalog, quote } = measurePanelWidths(container);
        onLiveWidthsRef.current?.(catalog, quote);
      }

      document.body.classList.remove("quote-panel-drag-active");
      onResizingChange?.(false);
      onCommit(currentPctRef.current);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [
    containerRef,
    onCommit,
    onResizingChange,
    scheduleFrame,
    syncPctToDom,
  ]);

  return { onPointerDown };
}
