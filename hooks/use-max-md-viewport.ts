"use client";

import { useEffect, useState } from "react";

/** Tailwind `max-md` — < 768px viewport. */
export function useMaxMdViewport(): boolean {
  const [maxMd, setMaxMd] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMaxMd(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return maxMd;
}
