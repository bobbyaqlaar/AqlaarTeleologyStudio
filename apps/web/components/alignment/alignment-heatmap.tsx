"use client";

import { ChevronRight } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { AlignmentStream, AlignmentUnit, OrgTheme } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/alignment/score-badge";
import { cn } from "@/lib/utils";

const THEMES: { id: OrgTheme; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "cost", label: "Cost" },
  { id: "cx", label: "CX" },
  { id: "ttm", label: "TTM" },
];

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  in_review: "outline",
  approved: "default",
  rejected: "destructive",
};

interface AlignmentHeatmapProps {
  stream: AlignmentStream;
  selectedUnit: AlignmentUnit | null;
  onSelect: (unit: AlignmentUnit) => void;
}

function themeCell(count: number): React.ReactNode {
  if (count === 0) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted/40 text-xs text-muted-foreground">
        –
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-xs font-medium tabular-nums",
        count >= 2 ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/80",
      )}
    >
      {count}
    </span>
  );
}

export function AlignmentHeatmap({
  stream,
  selectedUnit,
  onSelect,
}: AlignmentHeatmapProps): React.ReactNode {
  const streamMeta = VALUE_STREAM_META[stream.streamType];

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Alignment</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Current evidence</th>
              {THEMES.map((theme) => (
                <th key={theme.id} className="px-2 py-2 text-center font-medium">
                  {theme.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" aria-label="Select row" />
            </tr>
          </thead>
          <tbody>
            {stream.units.map((unit) => {
              const functionMeta = unit.functionUnit
                ? FUNCTION_UNIT_MAP[unit.functionUnit]
                : null;
              const selected =
                selectedUnit?.functionUnit === unit.functionUnit;
              const ev = unit.evidence;

              return (
                <tr
                  key={unit.functionUnit ?? "__stream__"}
                  className={cn(
                    "cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/20",
                    selected && "bg-primary/5",
                    unit.functionUnit && "bg-muted/5",
                  )}
                  onClick={() => onSelect(unit)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {unit.functionUnit ? (
                        <span className="text-muted-foreground">↳</span>
                      ) : null}
                      <div>
                        <p className="font-medium">
                          {functionMeta
                            ? functionMeta.label
                            : streamMeta.shortLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {functionMeta
                            ? "function drill-down"
                            : "stream-wide"}
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
                  <td className="px-3 py-2.5">
                    <ScoreBadge score={unit.score} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {unit.goals.length} goals · {unit.ambitions.length} ambitions
                    {unit.gaps.length > 0 ? (
                      <span className="ml-1 text-amber-500">
                        · {unit.gaps.length} gaps
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {ev.stepCount} steps · {ev.stepsWithSystems} systemized ·{" "}
                    {ev.ontologyClasses} classes
                    {ev.openComments > 0 ? (
                      <span className="ml-1 text-amber-500">
                        · {ev.openComments} open comments
                      </span>
                    ) : null}
                  </td>
                  {THEMES.map((theme) => (
                    <td key={theme.id} className="px-2 py-2.5 text-center">
                      {themeCell(unit.orgAmbitions[theme.id]?.length ?? 0)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <Badge
                      variant={STATUS_VARIANT[unit.approvalStatus] ?? "secondary"}
                      className="capitalize"
                    >
                      {unit.approvalStatus.replace("_", " ")}
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
