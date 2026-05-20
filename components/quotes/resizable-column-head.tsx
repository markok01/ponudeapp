"use client";

import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";
import { usePointerDrag } from "@/hooks/use-pointer-drag";
import { cellFontSizePx } from "@/lib/quote-workspace-layout";
import { cn } from "@/lib/utils";

export function ResizableColumnHead({
  children,
  className,
  align = "left",
  onResize,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  onResize: (deltaPx: number) => void;
}) {
  const { layout } = useQuoteWorkspaceLayout();
  const { onPointerDown } = usePointerDrag("x", onResize);
  const headerFont = cellFontSizePx(80, layout.rowHeightPx, "header");

  return (
    <th
      className={cn(
        "quote-resizable-th relative border border-border/50 px-2 font-bold",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className,
      )}
      style={{ height: layout.rowHeightPx, fontSize: headerFont }}
    >
      <span className="block truncate pr-1">{children}</span>
      <span
        role="separator"
        aria-orientation="vertical"
        title="Prevuci za širinu kolone"
        onPointerDown={onPointerDown}
        className="absolute -right-0.5 top-0 z-20 h-full w-2 cursor-col-resize touch-none hover:bg-primary/25 active:bg-primary/40"
      />
    </th>
  );
}
