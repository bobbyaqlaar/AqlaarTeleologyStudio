"use client";

import Link from "next/link";
import { Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { FunctionalUnit, ReviewQueueItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReviewQueueTableProps {
  items: ReviewQueueItem[];
  selectedId: string | null;
  canEdit: boolean;
  canApprove: boolean;
  functionUnits: FunctionalUnit[];
  busyId: string | null;
  onSelect: (item: ReviewQueueItem) => void;
  onApprove: (item: ReviewQueueItem) => void;
  onReject: (item: ReviewQueueItem) => void;
  onResolve: (item: ReviewQueueItem) => void;
}

const STATUS_VARIANT: Record<
  ReviewQueueItem["approvalStatus"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  in_review: "outline",
  approved: "default",
  rejected: "destructive",
  open: "secondary",
};

function canStakeholderActOnItem(
  item: ReviewQueueItem,
  functionUnits: FunctionalUnit[],
): boolean {
  if (item.artefactType === "process_feedback") {
    return false;
  }
  if (!item.functionUnit) {
    return true;
  }
  return functionUnits.includes(item.functionUnit);
}

const ARTEFACT_LABELS: Record<ReviewQueueItem["artefactType"], string> = {
  value_stream: "Value stream",
  teleology_row: "Teleology",
  process_feedback: "BPMN feedback",
  solution_option: "Solution option",
  initiative: "Initiative",
};

export function ReviewQueueTable({
  items,
  selectedId,
  canEdit,
  canApprove,
  functionUnits,
  busyId,
  onSelect,
  onApprove,
  onReject,
  onResolve,
}: ReviewQueueTableProps): React.ReactNode {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No review items yet. Submit streams or teleology rows for stakeholder review.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Artefact</th>
              <th className="px-3 py-2 font-medium">Stream</th>
              <th className="px-3 py-2 font-medium">Function</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const selected = item.id === selectedId;
              const functionMeta = item.functionUnit
                ? FUNCTION_UNIT_MAP[item.functionUnit]
                : null;
              const canAct = canStakeholderActOnItem(item, functionUnits);

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/20",
                    selected && "bg-primary/5",
                  )}
                  onClick={() => onSelect(item)}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {ARTEFACT_LABELS[item.artefactType]} · {item.subtitle}
                    </p>
                    {item.commentBody ? (
                      <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
                        “{item.commentBody}”
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {VALUE_STREAM_META[item.streamType].shortLabel}
                  </td>
                  <td className="px-3 py-2">
                    {functionMeta ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          className={cn("size-2 rounded-full", functionMeta.dotClass)}
                        />
                        {functionMeta.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">All</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={STATUS_VARIANT[item.approvalStatus]}
                      className="capitalize"
                    >
                      {item.approvalStatus.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className="flex flex-wrap gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Link
                        href={item.href}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "gap-1",
                        )}
                      >
                        <ExternalLink className="size-3.5" />
                        Open
                      </Link>

                      {canApprove &&
                      item.approvalStatus === "in_review" &&
                      canAct ? (
                        <>
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={busyId === item.id}
                            onClick={() => onApprove(item)}
                          >
                            <Check className="size-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            disabled={busyId === item.id}
                            onClick={() => onReject(item)}
                          >
                            <X className="size-3.5" />
                            Reject
                          </Button>
                        </>
                      ) : null}

                      {canEdit &&
                      item.artefactType === "process_feedback" &&
                      item.approvalStatus === "open" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={busyId === item.id}
                          onClick={() => onResolve(item)}
                        >
                          <RotateCcw className="size-3.5" />
                          Resolve
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
