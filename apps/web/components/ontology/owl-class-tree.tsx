"use client";

import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import type { FunctionalUnit, OwlClass } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface OwlClassTreeProps {
  classes: OwlClass[];
  selectedUri: string | null;
  highlightBpmnId: string | null;
  onSelect: (owlClass: OwlClass) => void;
}

export function OwlClassTree({
  classes,
  selectedUri,
  highlightBpmnId,
  onSelect,
}: OwlClassTreeProps): React.ReactNode {
  return (
    <div className="space-y-1">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        OWL classes (list)
      </p>
      <div className="max-h-[360px] space-y-1 overflow-auto rounded-lg border border-border bg-card p-2">
        {classes.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No classes in graph.</p>
        ) : (
          classes.map((owlClass) => {
            const unit = owlClass.functionUnit
              ? FUNCTION_UNIT_MAP[owlClass.functionUnit]
              : undefined;
            const linkedToHighlight =
              highlightBpmnId !== null &&
              owlClass.linkedBpmnElements.includes(highlightBpmnId);

            return (
              <button
                key={owlClass.uri}
                type="button"
                onClick={() => onSelect(owlClass)}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors",
                  selectedUri === owlClass.uri
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-muted/40",
                  linkedToHighlight && "ring-1 ring-primary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{owlClass.label}</span>
                  {unit ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn("size-2 rounded-full", unit.dotClass)}
                        aria-hidden
                      />
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      No fn
                    </Badge>
                  )}
                </div>
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {owlClass.uri.replace("http://ots.local/ontology/", "ots:")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {owlClass.linkedBpmnElements.length} BPMN link
                  {owlClass.linkedBpmnElements.length === 1 ? "" : "s"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
