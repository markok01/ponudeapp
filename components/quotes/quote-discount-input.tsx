"use client";

import { forwardRef, type ComponentProps, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type QuoteDiscountInputProps = Omit<ComponentProps<"input">, "type" | "className"> & {
  invalid?: boolean;
  className?: string;
  style?: CSSProperties;
};

export const QuoteDiscountInput = forwardRef<
  HTMLInputElement,
  QuoteDiscountInputProps
>(function QuoteDiscountInput(
  { invalid = false, className, style, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "quote-discount-field",
        invalid && "quote-discount-field--invalid",
        className,
      )}
      style={style}
    >
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        className="quote-discount-field__input"
        {...props}
      />
      <span className="quote-discount-field__suffix" aria-hidden>
        %
      </span>
    </div>
  );
});
