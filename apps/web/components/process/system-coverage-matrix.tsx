"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Grid3x3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { SYSTEM_MAP } from "@/lib/constants/systems";
import type { FunctionalUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CoverageTask {
  id: string;
  name: string;
  functionUnit?: FunctionalUnit;
  systems?: string[];
}

interface SystemCoverageMatrixProps {
  tasks: CoverageTask[];
  onSelectTask: (taskId: string) => void;
}

/**
 * Workshop view: which enterprise system runs each process step. Columns are
 * the systems mapped so far; steps with no system are flagged — those are
 * the manual/spreadsheet gaps stakeholders should confirm.
 */
export function SystemCoverageMatrix({
  tasks,
  onSelectTask,
}: SystemCoverageMatrixProps): React.ReactNode {
  const [open, setOpen] = useState(false);

  const systems = useMemo(() => {
    const used = new Set<string>();
    for (const task of tasks) {
      for (const systemId of task.systems ?? []) {
        used.add(systemId);
      }
    }
    return [...used].sort((a, b) =>
      (SYSTEM_MAP[a]?.name ?? a).localeCompare(SYSTEM_MAP[b]?.name ?? b),
    );
  }, [tasks]);

  const unmappedCount = tasks.filter((task) => !(task.systems?.length)).length;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-3 text-left"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <Grid3x3 className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">System coverage</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {systems.length} system{systems.length === 1 ? "" : "s"}
          <Badge
            variant={unmappedCount > 0 ? "secondary" : "default"}
            className={cn(unmappedCount > 0 && "text-amber-500")}
          >
            {unmappedCount > 0
              ? `${unmappedCount} unmapped`
              : "All steps mapped"}
          </Badge>
        </span>
      </button>

      {open ? (
        <div className="overflow-x-auto border-t border-border p-3">
          {systems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No systems mapped yet. Select a step on the canvas and add the
              systems that run it today.
            </p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Step</th>
                  {systems.map((systemId) => (
                    <th
                      key={systemId}
                      className="px-2 py-1.5 text-center font-medium"
                    >
                      {SYSTEM_MAP[systemId]?.name ?? systemId}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const unitMeta = task.functionUnit
                    ? FUNCTION_UNIT_MAP[task.functionUnit]
                    : undefined;
                  const taskSystems = task.systems ?? [];
                  const unmapped = taskSystems.length === 0;
                  return (
                    <tr
                      key={task.id}
                      className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
                      onClick={() => onSelectTask(task.id)}
                    >
                      <td className="max-w-[260px] py-1.5 pr-3">
                        <span className="flex items-center gap-1.5">
                          {unitMeta ? (
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                unitMeta.dotClass,
                              )}
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">{task.name}</span>
                          {unmapped ? (
                            <span className="shrink-0 text-xs text-amber-500">
                              · no system
                            </span>
                          ) : null}
                        </span>
                      </td>
                      {systems.map((systemId) => (
                        <td key={systemId} className="px-2 py-1.5 text-center">
                          {taskSystems.includes(systemId) ? (
                            <span
                              className="inline-block size-2.5 rounded-full bg-primary"
                              aria-label={`${task.name} runs on ${SYSTEM_MAP[systemId]?.name ?? systemId}`}
                            />
                          ) : (
                            <span className="text-muted-foreground/30">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
