"use client";

import { useEffect, useState } from "react";

/** Tailwind `max-md` — < 768px viewport. */
function readMaxMd(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function useMaxMdViewport(): boolean {
  const [maxMd, setMaxMd] = useState(readMaxMd);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMaxMd(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return maxMd;
}
