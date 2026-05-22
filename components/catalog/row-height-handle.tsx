"use client";

import { usePointerDrag } from "@/hooks/use-pointer-drag";
import { cn } from "@/lib/utils";

type RowHeightHandleProps = {
  onResize: (delta: number) => void;
  className?: string;
  title?: string;
};

export function RowHeightHandle({
  onResize,
  className,
  title,
}: RowHeightHandleProps) {
  const { onPointerDown } = usePointerDrag("y", onResize);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      title={title}
      className={cn(
        "catalog-row-resize-handle flex h-2 w-full shrink-0 cursor-row-resize touch-none items-center justify-center",
        className,
      )}
      onPointerDown={onPointerDown}
    >
      <span className="h-0.5 w-10 rounded-full bg-border/80 transition-colors hover:bg-primary/40" />
    </div>
  );
}
