"use client";

import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 480;

/** Dugi pritisak na red cenovnika — prikaži naziv bez dodavanja u ponudu. */
export function useCatalogRowPeek(onPeek: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(() => {
    longPressRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressRef.current = true;
      onPeek();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, LONG_PRESS_MS);
  }, [clearTimer, onPeek]);

  const onTouchEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const consumeLongPress = useCallback(() => {
    if (longPressRef.current) {
      longPressRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel: onTouchEnd, consumeLongPress };
}
