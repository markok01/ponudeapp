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
  const pendingRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const onDeltaRef = useRef(onDelta);
  onDeltaRef.current = onDelta;

  const flush = useCallback(() => {
    rafRef.current = null;
    const d = pendingRef.current;
    if (d !== 0) {
      pendingRef.current = 0;
      onDeltaRef.current(d);
    }
  }, []);

  const scheduleDelta = useCallback(
    (delta: number) => {
      if (delta === 0) return;
      pendingRef.current += delta;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

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
      scheduleDelta(current - startRef.current);
      startRef.current = current;
    };

    const onUp = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        flush();
      }
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
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [axis, scheduleDelta, flush]);

  return { onPointerDown };
}
