"use client";

import { cn } from "@/lib/utils";
import { usePointerDrag } from "@/hooks/use-pointer-drag";

type ResizableColumnHeadProps = {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  onResize?: (delta: number) => void;
  rowHeightPx: number;
  headerFontPx: number;
  className?: string;
  resizable?: boolean;
};

export function ResizableColumnHead({
  children,
  align = "left",
  onResize,
  rowHeightPx,
  headerFontPx,
  className,
  resizable = true,
}: ResizableColumnHeadProps) {
  const { onPointerDown } = usePointerDrag("x", (d) => onResize?.(d), Boolean(onResize && resizable));

  return (
    <th
      className={cn(
        "catalog-cell catalog-th relative border border-border/50 font-bold",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        className,
      )}
      style={{
        height: rowHeightPx,
        fontSize: headerFontPx,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <span className="block truncate px-1">{children}</span>
      {onResize && resizable ? (
        <span
          role="separator"
          aria-orientation="vertical"
          className="catalog-col-resize-handle absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none"
          onPointerDown={onPointerDown}
        />
      ) : null}
    </th>
  );
}
