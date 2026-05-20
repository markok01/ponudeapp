"use client";

import { useCallback, useEffect, useRef } from "react";

type DragAxis = "x" | "y";

export function usePointerDrag(
  axis: DragAxis,
  onDelta: (delta: number) => void,
  enabled = true,
) {
  const startRef = useRef(0);
  const activeRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      activeRef.current = true;
      startRef.current = axis === "x" ? e.clientX : e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [axis, enabled],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!activeRef.current) return;
      const current = axis === "x" ? e.clientX : e.clientY;
      const delta = current - startRef.current;
      if (delta !== 0) {
        onDelta(delta);
        startRef.current = current;
      }
    };

    const onUp = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [axis, onDelta]);

  return { onPointerDown, isDragging: activeRef };
}
