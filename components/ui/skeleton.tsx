import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-[var(--radius-md)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
