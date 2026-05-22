"use client";

import { useEffect, useState } from "react";

/** Tailwind `max-lg` — viewport &lt; 1024px. */
export function useMaxLgViewport(): boolean {
  const [maxLg, setMaxLg] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setMaxLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return maxLg;
}
