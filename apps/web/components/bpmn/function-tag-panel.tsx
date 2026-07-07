"use client";

import { FUNCTION_UNIT_MAP, FUNCTION_UNITS } from "@/lib/constants/function-units";
import type { FunctionalUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
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
  canEdit: boolean;
  onAssign: (functionUnit: FunctionalUnit | undefined) => void;
}

export function FunctionTagPanel({
  elementId,
  elementName,
  elementType,
  functionUnit,
  canEdit,
  onAssign,
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

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Selected step
        </p>
        <p className="mt-1 font-medium">{elementName ?? elementId}</p>
        <p className="font-mono text-xs text-muted-foreground">{elementId}</p>
      </div>

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
