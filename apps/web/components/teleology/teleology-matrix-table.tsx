"use client";

import { ChevronRight } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { TeleologyRow } from "@/lib/types";
import { OrgThemeSummary } from "@/components/teleology/org-theme-section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TeleologyMatrixTableProps {
  rows: TeleologyRow[];
  selectedRowId: string | null;
  onSelect: (row: TeleologyRow) => void;
}

const STATUS_VARIANT: Record<
  TeleologyRow["approvalStatus"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  in_review: "outline",
  approved: "default",
  rejected: "destructive",
};

export function TeleologyMatrixTable({
  rows,
  selectedRowId,
  onSelect,
}: TeleologyMatrixTableProps): React.ReactNode {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No teleology rows for this stream. Load a value stream baseline first.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Goals</th>
              <th className="px-3 py-2 font-medium">Gaps</th>
              <th className="px-3 py-2 font-medium">Ambitions</th>
              <th className="px-3 py-2 font-medium">Org themes</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" aria-label="Select row" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const streamMeta = VALUE_STREAM_META[row.streamType];
              const functionMeta = row.functionUnit
                ? FUNCTION_UNIT_MAP[row.functionUnit]
                : null;
              const selected = row.id === selectedRowId;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/20",
                    selected && "bg-primary/5",
                    row.functionUnit && "bg-muted/5",
                  )}
                  onClick={() => onSelect(row)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {row.functionUnit ? (
                        <span className="text-muted-foreground">↳</span>
                      ) : null}
                      <div>
                        <p className="font-medium">
                          {functionMeta ? functionMeta.label : streamMeta.shortLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {functionMeta
                            ? `${streamMeta.shortLabel} · function drill-down`
                            : streamMeta.label}
                        </p>
                      </div>
                      {functionMeta ? (
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            functionMeta.dotClass,
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.goals.length}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.gaps.length}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.ambitions.length}
                  </td>
                  <td className="px-3 py-2.5">
                    <OrgThemeSummary orgAmbitions={row.orgAmbitions} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant={STATUS_VARIANT[row.approvalStatus]}
                      className="capitalize"
                    >
                      {row.approvalStatus.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <ChevronRight className="size-4" />
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
