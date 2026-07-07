"use client";

import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import type { FunctionalUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BpmnTaskListProps {
  tasks: Array<{ id: string; name: string; functionUnit?: FunctionalUnit }>;
  selectedId: string | null;
  filterFunction?: FunctionalUnit | "all";
  onSelect: (taskId: string) => void;
}

export function BpmnTaskList({
  tasks,
  selectedId,
  filterFunction = "all",
  onSelect,
}: BpmnTaskListProps): React.ReactNode {
  const filtered =
    filterFunction === "all"
      ? tasks
      : tasks.filter((task) => task.functionUnit === filterFunction);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Process steps
      </p>
      <div className="max-h-48 space-y-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No steps for this filter.</p>
        ) : (
          filtered.map((task) => {
            const unit = task.functionUnit
              ? FUNCTION_UNIT_MAP[task.functionUnit]
              : undefined;

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelect(task.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors",
                  selectedId === task.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span className="truncate">{task.name}</span>
                {unit ? (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn("size-2 rounded-full", unit.dotClass)}
                      aria-hidden
                    />
                    <span className="text-xs text-muted-foreground">
                      {unit.label}
                    </span>
                  </span>
                ) : (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Untagged
                  </Badge>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
