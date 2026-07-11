"use client";

import { cn } from "@/lib/utils";

export function scoreTone(score: number): {
  text: string;
  bar: string;
  bg: string;
} {
  if (score >= 70) {
    return {
      text: "text-emerald-500",
      bar: "bg-emerald-500",
      bg: "bg-emerald-500/10",
    };
  }
  if (score >= 40) {
    return {
      text: "text-amber-500",
      bar: "bg-amber-500",
      bg: "bg-amber-500/10",
    };
  }
  return { text: "text-red-500", bar: "bg-red-500", bg: "bg-red-500/10" };
}

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps): React.ReactNode {
  const tone = scoreTone(score);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("text-sm font-semibold tabular-nums", tone.text)}>
        {score}
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone.bar)}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}
