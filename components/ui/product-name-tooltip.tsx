"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const SHOW_DELAY_MS = 420;
const HIDE_DELAY_MS = 80;

type ProductNameTooltipProps = {
  /** Pun naziv proizvoda u tooltip-u. */
  text: string;
  children: ReactNode;
  className?: string;
  /** Ne prikazuj tooltip (npr. prazan naziv). */
  disabled?: boolean;
};

function measureTruncated(node: HTMLElement | null): boolean {
  if (!node) return false;
  const target =
    node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
      ? node
      : (node.firstElementChild as HTMLElement | null) ?? node;
  return (
    target.scrollWidth > target.clientWidth + 1 ||
    target.scrollHeight > target.clientHeight + 1
  );
}

export function ProductNameTooltip({
  text,
  children,
  className,
  disabled = false,
}: ProductNameTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState<{
    top: number;
    left: number;
    above: boolean;
  }>({ top: 0, left: 0, above: true });

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearTimers = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const updatePlacement = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const above = rect.top > 72;
    const top = above ? rect.top - 10 : rect.bottom + 10;
    const left = rect.left + rect.width / 2;
    setPlacement({ top, left, above });
  }, []);

  const openTooltip = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || disabled || !text.trim()) return;
    if (!measureTruncated(anchor)) return;
    updatePlacement();
    setVisible(true);
  }, [disabled, text, updatePlacement]);

  const scheduleShow = useCallback(() => {
    clearTimers();
    showTimer.current = setTimeout(() => {
      showTimer.current = null;
      openTooltip();
    }, SHOW_DELAY_MS);
  }, [clearTimers, openTooltip]);

  const scheduleHide = useCallback(() => {
    clearTimers();
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      setVisible(false);
    }, HIDE_DELAY_MS);
  }, [clearTimers]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const ro = new ResizeObserver(() => {
      if (visible) updatePlacement();
    });
    ro.observe(anchor);
    const inner = anchor.firstElementChild;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [text, visible, updatePlacement]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!visible) return;
    const onScrollOrResize = () => updatePlacement();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [visible, updatePlacement]);

  const tooltip =
    mounted && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {visible ? (
              <motion.div
                key="product-name-tooltip"
                role="tooltip"
                initial={{
                  opacity: 0,
                  scale: 0.9,
                  y: placement.above ? 6 : -6,
                }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.94,
                  y: placement.above ? 4 : -4,
                }}
                transition={{
                  type: "spring",
                  stiffness: 560,
                  damping: 32,
                  mass: 0.65,
                }}
                className="product-name-tooltip pointer-events-none fixed z-[200] max-w-[min(20rem,calc(100vw-1.5rem))]"
                style={{
                  top: placement.top,
                  left: placement.left,
                  transform: placement.above
                    ? "translate(-50%, -100%)"
                    : "translate(-50%, 0)",
                }}
              >
                <p className="product-name-tooltip__text">{text}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={cn("inline-block min-w-0 max-w-full", className)}
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
        onFocus={scheduleShow}
        onBlur={scheduleHide}
        onTouchStart={scheduleShow}
        onTouchEnd={scheduleHide}
        onTouchCancel={scheduleHide}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}

type TruncatedProductNameProps = {
  name: string;
  className?: string;
  lines?: 1 | 2;
};

/** Skraćeni naziv u ćeliji + iOS tooltip kad je tekst isečen. */
export function TruncatedProductName({
  name,
  className,
  lines = 1,
}: TruncatedProductNameProps) {
  return (
    <ProductNameTooltip text={name}>
      <span
        className={cn(
          "block min-w-0 max-w-full",
          lines === 1
            ? "truncate whitespace-nowrap"
            : "line-clamp-2 whitespace-normal break-words",
          className,
        )}
      >
        {name}
      </span>
    </ProductNameTooltip>
  );
}
