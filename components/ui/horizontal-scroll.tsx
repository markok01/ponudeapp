import { cn } from "@/lib/utils";

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
  /** Prikaži hint za horizontalni skrol na malim ekranima */
  hint?: boolean;
}

/** Brz horizontalni skrol za široke tabele na telefonu. */
export function HorizontalScroll({
  children,
  className,
  hint = true,
}: HorizontalScrollProps) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        className={cn(
          "overflow-x-auto overscroll-x-contain",
          "scroll-smooth [-webkit-overflow-scrolling:touch]",
          "touch-pan-x",
          "max-md:scroll-px-2",
        )}
      >
        {children}
      </div>
      {hint ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-card via-card/80 to-transparent md:hidden"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
