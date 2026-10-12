"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type InfoHintProps = {
  text: string;
  label?: string;
  className?: string;
  side?: "top" | "bottom";
};

export function InfoHint({
  text,
  label = "Više informacija",
  className,
  side = "top",
}: InfoHintProps) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  if (!text.trim()) return null;

  return (
    <span
      ref={rootRef}
      className={cn("info-hint", className)}
      data-open={open}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
    >
      <button
        type="button"
        className="info-hint__btn"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg
          viewBox="0 0 16 16"
          width="10"
          height="10"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.2v3.6" strokeLinecap="round" />
          <circle cx="8" cy="5.1" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="info-hint__panel"
          data-side={side}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

/** Label + optional ⓘ hint in one row */
export function LabelWithHint({
  children,
  hint,
  hintLabel,
  className,
  htmlFor,
}: {
  children: ReactNode;
  hint?: string;
  hintLabel?: string;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
          {children}
        </label>
      ) : (
        <span className="text-xs font-medium text-foreground">{children}</span>
      )}
      {hint ? <InfoHint text={hint} label={hintLabel} /> : null}
    </span>
  );
}
