"use client";

import { Link2, Unlink } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import type { FunctionalUnit, OwlClass } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BpmnLinkPanelProps {
  tasks: Array<{ id: string; name: string; functionUnit?: FunctionalUnit }>;
  classes: OwlClass[];
  selectedClassUri: string | null;
  selectedTaskId: string | null;
  canEdit: boolean;
  linking: boolean;
  onSelectTask: (taskId: string) => void;
  onLink: (taskId: string) => void;
  onUnlink: (taskId: string, classUri: string) => void;
}

function findLinkedClass(
  classes: OwlClass[],
  taskId: string,
): OwlClass | undefined {
  return classes.find((owlClass) =>
    owlClass.linkedBpmnElements.includes(taskId),
  );
}

export function BpmnLinkPanel({
  tasks,
  classes,
  selectedClassUri,
  selectedTaskId,
  canEdit,
  linking,
  onSelectTask,
  onLink,
  onUnlink,
}: BpmnLinkPanelProps): React.ReactNode {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" />
          <p className="text-sm font-medium">BPMN links</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Map process steps to OWL classes. Select a class, then link a step.
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-auto p-3">
        {tasks.map((task) => {
          const linkedClass = findLinkedClass(classes, task.id);
          const unit = task.functionUnit
            ? FUNCTION_UNIT_MAP[task.functionUnit]
            : undefined;
          const isSelected = selectedTaskId === task.id;
          const classSelected = selectedClassUri !== null;

          return (
            <div
              key={task.id}
              className={cn(
                "rounded-md border p-3 transition-colors",
                isSelected ? "border-primary bg-primary/5" : "border-border",
                linkedClass &&
                  selectedClassUri === linkedClass.uri &&
                  "ring-1 ring-primary/30",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 text-left"
                onClick={() => onSelectTask(task.id)}
              >
                <div>
                  <p className="text-sm font-medium">{task.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {task.id}
                  </p>
                </div>
                {unit ? (
                  <span
                    className={cn("mt-1 size-2.5 rounded-full", unit.dotClass)}
                    aria-hidden
                  />
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Untagged
                  </Badge>
                )}
              </button>

              <div className="mt-2 text-xs text-muted-foreground">
                {linkedClass ? (
                  <span>
                    Linked →{" "}
                    <span className="font-medium text-foreground">
                      {linkedClass.label}
                    </span>
                  </span>
                ) : (
                  <span>No OWL class linked</span>
                )}
              </div>

              {canEdit ? (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={!classSelected || linking}
                    onClick={() => onLink(task.id)}
                  >
                    <Link2 className="size-3" />
                    Link selected class
                  </Button>
                  {linkedClass ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={linking}
                      onClick={() => onUnlink(task.id, linkedClass.uri)}
                    >
                      <Unlink className="size-3" />
                      Unlink
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
