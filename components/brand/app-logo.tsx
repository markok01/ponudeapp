import { cn } from "@/lib/utils";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  appName?: string;
  tagline?: string;
  className?: string;
};

const sizes = {
  sm: { box: "h-9 w-9", icon: 20, title: "text-sm", sub: "text-[10px]" },
  md: { box: "h-11 w-11", icon: 24, title: "text-base", sub: "text-[11px]" },
  lg: { box: "h-14 w-14", icon: 30, title: "text-lg", sub: "text-xs" },
};

/** iOS-style app mark: soft gradient tile + minimal document glyph */
export function AppLogo({
  size = "md",
  showWordmark = true,
  appName = "PonudeApp",
  tagline,
  className,
}: AppLogoProps) {
  const s = sizes[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "app-logo-tile relative flex shrink-0 items-center justify-center rounded-[22%] shadow-[0_2px_12px_rgba(91,141,239,0.35)]",
          s.box,
        )}
        aria-hidden
      >
        <svg
          viewBox="0 0 32 32"
          width={s.icon}
          height={s.icon}
          className="text-white"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="7"
            y="6"
            width="18"
            height="20"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M11 12h10M11 16h10M11 20h6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showWordmark ? (
        <div className="min-w-0">
          <p className={cn("font-semibold tracking-tight text-foreground", s.title)}>
            {appName}
          </p>
          {tagline ? (
            <p className={cn("truncate text-muted-foreground", s.sub)}>{tagline}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
