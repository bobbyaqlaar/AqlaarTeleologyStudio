"use client";

import { Check, X } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { Initiative, InitiativeHorizon, OrgTheme } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HORIZON_META: Record<InitiativeHorizon, { label: string; className: string }> = {
  now: { label: "Now", className: "bg-emerald-500/10 text-emerald-500" },
  next: { label: "Next", className: "bg-primary/10 text-primary" },
  later: { label: "Later", className: "bg-muted/60 text-muted-foreground" },
};

const THEME_LABEL: Record<OrgTheme, string> = {
  revenue: "Revenue",
  cost: "Cost",
  cx: "CX",
  ttm: "TTM",
};

interface InitiativeCardProps {
  initiative: Initiative;
  selected: boolean;
  canEdit: boolean;
  busy: boolean;
  onSelect: (initiative: Initiative) => void;
  onAccept: (initiative: Initiative) => void;
  onDismiss: (initiative: Initiative) => void;
}

export function InitiativeCard({
  initiative,
  selected,
  canEdit,
  busy,
  onSelect,
  onAccept,
  onDismiss,
}: InitiativeCardProps): React.ReactNode {
  const horizon = HORIZON_META[initiative.horizon];

  return (
    <div
      className={cn(
        "cursor-pointer space-y-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/10",
        selected && "border-primary/50 bg-primary/[0.03]",
        initiative.status === "accepted" && "border-emerald-500/40",
        initiative.status === "dismissed" && "opacity-50",
      )}
      onClick={() => onSelect(initiative)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium leading-snug">{initiative.name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                horizon.className,
              )}
            >
              {horizon.label}
            </span>
            {initiative.streams.map((streamType) => (
              <span
                key={streamType}
                className="rounded-full border border-border px-2 py-0.5 text-xs font-medium"
              >
                {VALUE_STREAM_META[streamType]?.shortLabel ?? streamType}
              </span>
            ))}
          </div>
        </div>
        {initiative.status !== "draft" ? (
          <Badge
            variant={initiative.status === "accepted" ? "default" : "secondary"}
            className="capitalize"
          >
            {initiative.status}
          </Badge>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{initiative.narrative}</p>

      {initiative.functionUnits.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {initiative.functionUnits.map((unit) => {
            const meta = FUNCTION_UNIT_MAP[unit];
            if (!meta) {
              return null;
            }
            return (
              <span
                key={unit}
                className="flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-xs"
              >
                <span
                  className={cn("size-1.5 rounded-full", meta.dotClass)}
                  aria-hidden
                />
                {meta.label}
              </span>
            );
          })}
        </div>
      ) : null}

      {Object.entries(initiative.orgImpact).filter(([, value]) => value)
        .length > 0 ? (
        <div className="space-y-1 border-t border-border/70 pt-2">
          {Object.entries(initiative.orgImpact).map(([theme, value]) =>
            value ? (
              <p key={theme} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {THEME_LABEL[theme as OrgTheme] ?? theme}:
                </span>{" "}
                {value}
              </p>
            ) : null,
          )}
        </div>
      ) : null}

      {canEdit && initiative.status === "draft" ? (
        <div
          className="flex gap-2 border-t border-border/70 pt-3"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => onAccept(initiative)}
          >
            <Check className="size-4" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => onDismiss(initiative)}
          >
            <X className="size-4" />
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}
