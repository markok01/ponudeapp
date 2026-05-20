"use client";

interface ProgressRingProps {
  progress: number;
  message: string;
  subMessage?: string;
}

export function ProgressRing({ progress, message, subMessage }: ProgressRingProps) {
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-primary transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums">
          {clamped}%
        </span>
      </div>
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {subMessage && (
          <p className="mt-1 text-xs text-muted-foreground">{subMessage}</p>
        )}
      </div>
    </div>
  );
}
