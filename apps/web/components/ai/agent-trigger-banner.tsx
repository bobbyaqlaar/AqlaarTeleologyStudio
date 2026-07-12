"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentTriggerBannerProps {
  message: string;
  onDismiss: () => void;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

/** Dismissible banner when an event-driven drafting agent completes. */
export function AgentTriggerBanner({
  message,
  onDismiss,
  actionHref,
  actionLabel = "Review",
  className,
}: AgentTriggerBannerProps): React.ReactNode {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm shadow-sm",
        className,
      )}
    >
      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-foreground">AI draft ready</p>
        <p className="text-muted-foreground">{message}</p>
        {actionHref ? (
          <Link
            href={actionHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 shrink-0 p-0"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
