"use client";

import { useEffect, useRef, useState } from "react";

type UseContainerWidthOptions = {
  /** false = samo ref (širinu tokom panel-drag-a daje layout context). */
  observe?: boolean;
};

/** Širina elementa (ResizeObserver + rAF, bez layout thrashing-a). */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(
  options: UseContainerWidthOptions = {},
) {
  const observe = options.observe ?? true;
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!observe) {
      return;
    }

    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setWidth(Math.round(w));
        raf = 0;
      });
    });

    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [observe]);

  return { ref, width };
}
