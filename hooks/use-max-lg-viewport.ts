"use client";

import { useEffect, useState } from "react";

/** Tailwind `max-lg` — viewport &lt; 1024px. */
function readMaxLg(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

export function useMaxLgViewport(): boolean {
  const [maxLg, setMaxLg] = useState(readMaxLg);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setMaxLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return maxLg;
}
