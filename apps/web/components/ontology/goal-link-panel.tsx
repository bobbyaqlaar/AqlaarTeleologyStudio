"use client";

import { Link2, Target, Unlink } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { OwlClass, TeleologyRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GoalLinkPanelProps {
  teleologyRows: TeleologyRow[];
  selectedClass: OwlClass | null;
  canEdit: boolean;
  linking: boolean;
  onLink: (teleologyRowId: string) => void;
  onUnlink: (teleologyRowId: string) => void;
}

/** ots:supportsGoal — trace which teleology rows (goals) the selected
 * ontology class supports. Feeds goal traceability in the alignment score. */
export function GoalLinkPanel({
  teleologyRows,
  selectedClass,
  canEdit,
  linking,
  onLink,
  onUnlink,
}: GoalLinkPanelProps): React.ReactNode {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Target className="size-4 text-primary" />
        <p className="text-sm font-medium">Goal links</p>
        <span className="text-xs text-muted-foreground">
          class → teleology row
        </span>
      </div>
      <div className="max-h-64 space-y-2 overflow-auto p-3">
        {!selectedClass ? (
          <p className="text-sm text-muted-foreground">
            Select an OWL class to link it to the goals it supports.
          </p>
        ) : teleologyRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teleology rows for this stream yet — capture goals first.
          </p>
        ) : (
          teleologyRows.map((row) => {
            const linked = selectedClass.supportsGoals.includes(row.id);
            const functionMeta = row.functionUnit
              ? FUNCTION_UNIT_MAP[row.functionUnit]
              : null;
            const streamMeta = VALUE_STREAM_META[row.streamType];

            return (
              <div
                key={row.id}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-md border px-3 py-2",
                  linked
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-muted/10",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {functionMeta
                      ? `${functionMeta.label} goals`
                      : `${streamMeta.shortLabel} stream goals`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.goals[0] ?? "No goals captured yet"}
                    {row.goals.length > 1 ? ` (+${row.goals.length - 1})` : ""}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant={linked ? "outline" : "default"}
                    className="shrink-0 gap-1"
                    disabled={linking}
                    onClick={() =>
                      linked ? onUnlink(row.id) : onLink(row.id)
                    }
                  >
                    {linked ? (
                      <>
                        <Unlink className="size-3.5" />
                        Unlink
                      </>
                    ) : (
                      <>
                        <Link2 className="size-3.5" />
                        Link
                      </>
                    )}
                  </Button>
                ) : linked ? (
                  <span className="text-xs text-primary">linked</span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
