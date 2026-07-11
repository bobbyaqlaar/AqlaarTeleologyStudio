"use client";

import { Check, X } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import type { SolutionOption, SolutionOptionType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTION_TYPE_META: Record<
  SolutionOptionType,
  { label: string; className: string }
> = {
  quick_win: {
    label: "Quick win",
    className: "bg-emerald-500/10 text-emerald-500",
  },
  strategic: { label: "Strategic", className: "bg-primary/10 text-primary" },
  transformational: {
    label: "Transformational",
    className: "bg-purple-500/10 text-purple-500",
  },
};

const CHANGE_KIND_LABEL: Record<string, string> = {
  add_step: "Add step",
  modify_step: "Modify step",
  tag_system: "Tag system",
  add_class: "Add class",
  link_class_goal: "Link class to goal",
  update_teleology: "Update teleology",
  other: "Other",
};

interface SolutionOptionCardProps {
  option: SolutionOption;
  canEdit: boolean;
  busy: boolean;
  onAccept: (option: SolutionOption) => void;
  onDismiss: (option: SolutionOption) => void;
}

export function SolutionOptionCard({
  option,
  canEdit,
  busy,
  onAccept,
  onDismiss,
}: SolutionOptionCardProps): React.ReactNode {
  const typeMeta = OPTION_TYPE_META[option.optionType];
  const functionMeta = option.functionUnit
    ? FUNCTION_UNIT_MAP[option.functionUnit]
    : null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border bg-card p-4",
        option.status === "accepted" && "border-emerald-500/40",
        option.status === "dismissed" && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium leading-snug">{option.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                typeMeta.className,
              )}
            >
              {typeMeta.label}
            </span>
            {functionMeta ? (
              <span className="flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-xs">
                <span
                  className={cn("size-1.5 rounded-full", functionMeta.dotClass)}
                  aria-hidden
                />
                {functionMeta.label}
              </span>
            ) : (
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs">
                Stream-wide
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              effort {option.effort} · impact {option.impact}
            </span>
          </div>
        </div>
        {option.status !== "draft" ? (
          <Badge
            variant={option.status === "accepted" ? "default" : "secondary"}
            className="capitalize"
          >
            {option.status}
          </Badge>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{option.rationale}</p>

      {option.proposedChanges.length > 0 ? (
        <ul className="space-y-1">
          {option.proposedChanges.map((change, index) => (
            <li
              key={`${option.id}-change-${index}`}
              className="flex items-start gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-xs"
            >
              <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 font-medium">
                {CHANGE_KIND_LABEL[change.kind] ?? change.kind}
              </span>
              <span>
                {change.description}
                {change.targetLabel ? (
                  <span className="text-muted-foreground">
                    {" "}
                    — {change.targetLabel}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {option.impactedSteps.length > 0 || option.impactedClasses.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {option.impactedSteps.map((step) => (
            <span
              key={`${option.id}-step-${step.name}`}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              ⚙ {step.name}
            </span>
          ))}
          {option.impactedClasses.map((cls) => (
            <span
              key={`${option.id}-class-${cls.label}`}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              ◆ {cls.label}
            </span>
          ))}
        </div>
      ) : null}

      {canEdit && option.status === "draft" ? (
        <div className="flex gap-2 border-t border-border/70 pt-3">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => onAccept(option)}
          >
            <Check className="size-4" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => onDismiss(option)}
          >
            <X className="size-4" />
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}
