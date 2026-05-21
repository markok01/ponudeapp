import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-card/90 px-3.5 py-2 text-base text-foreground shadow-sm transition-all duration-200 sm:text-sm",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-primary/40 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
