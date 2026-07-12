"use client";

import { Sparkles } from "lucide-react";
import { FUNCTION_UNIT_MAP, FUNCTION_UNITS } from "@/lib/constants/function-units";
import { SYSTEM_MAP } from "@/lib/constants/systems";
import type { AiTagSuggestion, FunctionalUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface FunctionTagPanelProps {
  elementId: string | null;
  elementName: string | null;
  elementType: string | null;
  functionUnit?: FunctionalUnit;
  aiSuggestion?: AiTagSuggestion | null;
  canEdit: boolean;
  onAssign: (functionUnit: FunctionalUnit | undefined) => void;
  onAcceptSuggestion?: () => void;
  onDismissSuggestion?: () => void;
}

export function FunctionTagPanel({
  elementId,
  elementName,
  elementType,
  functionUnit,
  aiSuggestion,
  canEdit,
  onAssign,
  onAcceptSuggestion,
  onDismissSuggestion,
}: FunctionTagPanelProps): React.ReactNode {
  if (!elementId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Select a process step on the canvas to assign a function unit.
      </div>
    );
  }

  const isTask = elementType?.includes("Task");
  const unitMeta = functionUnit ? FUNCTION_UNIT_MAP[functionUnit] : undefined;
  const suggestedUnit = aiSuggestion
    ? FUNCTION_UNIT_MAP[aiSuggestion.functionUnit]
    : undefined;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Selected step
        </p>
        <p className="mt-1 font-medium">{elementName ?? elementId}</p>
        <p className="font-mono text-xs text-muted-foreground">{elementId}</p>
      </div>

      {isTask && aiSuggestion && canEdit ? (
        <div className="space-y-3 rounded-md border border-violet-500/30 bg-violet-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-violet-600 dark:text-violet-400">
            <Sparkles className="size-3.5" />
            AI tag suggestion
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Function: </span>
              {suggestedUnit?.label ?? aiSuggestion.functionUnit}
            </p>
            {aiSuggestion.systems.length > 0 ? (
              <p>
                <span className="text-muted-foreground">Systems: </span>
                {aiSuggestion.systems
                  .map((id) => SYSTEM_MAP[id]?.name ?? id)
                  .join(", ")}
              </p>
            ) : null}
            {aiSuggestion.rationale ? (
              <p className="text-xs text-muted-foreground">
                {aiSuggestion.rationale}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onAcceptSuggestion?.()}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDismissSuggestion?.()}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {isTask ? (
        <div className="space-y-2">
          <Label htmlFor="function-unit">Function unit</Label>
          {canEdit ? (
            <Select
              value={functionUnit ?? "unset"}
              onValueChange={(value) =>
                onAssign(value === "unset" ? undefined : (value as FunctionalUnit))
              }
            >
              <SelectTrigger id="function-unit" className="w-full">
                <SelectValue placeholder="Select function" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not assigned</SelectItem>
                {FUNCTION_UNITS.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={unitMeta ? "default" : "secondary"}>
              {unitMeta?.label ?? "Not assigned"}
            </Badge>
          )}
          {unitMeta ? (
            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn("size-2.5 rounded-full", unitMeta.dotClass)}
                aria-hidden
              />
              <span className={unitMeta.colorClass}>{unitMeta.label}</span>
            </div>
          ) : (
            <p className="text-xs text-amber-500">
              Required before save and stakeholder review.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Function units apply to tasks only.
        </p>
      )}
    </div>
  );
}
