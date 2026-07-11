"use client";

import { Target, Workflow } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { AlignmentUnit, ValueStreamType } from "@/lib/types";
import { ScoreBadge, scoreTone } from "@/components/alignment/score-badge";
import { cn } from "@/lib/utils";

interface AlignmentDetailPanelProps {
  streamType: ValueStreamType;
  unit: AlignmentUnit | null;
}

const BREAKDOWN_ROWS: {
  key: keyof AlignmentUnit["scoreBreakdown"];
  label: string;
  max: number;
}[] = [
  { key: "goalsDefined", label: "Goals & ambitions defined", max: 20 },
  { key: "processEvidence", label: "Process steps mapped", max: 20 },
  { key: "systemCoverage", label: "Systems on steps", max: 20 },
  { key: "ontologyCoverage", label: "Ontology coverage", max: 20 },
  { key: "goalTraceability", label: "Ontology → goal links", max: 10 },
  { key: "feedbackClear", label: "Feedback resolved", max: 10 },
];

function ListBlock({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone?: "amber";
}): React.ReactNode {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li
              key={item}
              className={cn(
                "rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-sm",
                tone === "amber" && "border-amber-500/30 bg-amber-500/5",
              )}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AlignmentDetailPanel({
  streamType,
  unit,
}: AlignmentDetailPanelProps): React.ReactNode {
  if (!unit) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Select a row to compare current state against the teleology.
      </div>
    );
  }

  const streamMeta = VALUE_STREAM_META[streamType];
  const functionMeta = unit.functionUnit
    ? FUNCTION_UNIT_MAP[unit.functionUnit]
    : null;
  const ev = unit.evidence;
  const tone = scoreTone(unit.score);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {functionMeta ? functionMeta.label : `${streamMeta.shortLabel} stream-wide`}
          </p>
          <p className="text-xs text-muted-foreground">
            Current state vs teleology
          </p>
        </div>
        <div className={cn("rounded-lg px-3 py-1.5", tone.bg)}>
          <ScoreBadge score={unit.score} />
        </div>
      </div>

      <div className="space-y-1.5">
        {BREAKDOWN_ROWS.map((row) => {
          const value = unit.scoreBreakdown[row.key];
          return (
            <div key={row.key} className="flex items-center gap-2 text-xs">
              <span className="w-44 shrink-0 text-muted-foreground">
                {row.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    value >= row.max * 0.7
                      ? "bg-emerald-500"
                      : value >= row.max * 0.4
                        ? "bg-amber-500"
                        : "bg-red-500",
                  )}
                  style={{ width: `${(value / row.max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                {value}/{row.max}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Workflow className="size-4 text-muted-foreground" />
            Current state
          </div>
          <p className="text-xs text-muted-foreground">
            {ev.stepCount} process steps · {ev.stepsWithSystems} with systems ·{" "}
            {ev.ontologyClasses} ontology classes ({ev.bpmnLinkedClasses}{" "}
            BPMN-linked, {ev.goalLinkedClasses} goal-linked) ·{" "}
            {ev.openComments} open comments
          </p>
          {ev.systems.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Systems: {ev.systems.join(", ")}
            </p>
          ) : null}
          {ev.stepNames.length > 0 ? (
            <ul className="space-y-1">
              {ev.stepNames.map((name) => (
                <li
                  key={name}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs"
                >
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No process steps mapped yet.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="size-4 text-primary" />
            Teleology (target)
          </div>
          <ListBlock
            title="Goals"
            items={unit.goals}
            emptyLabel="No goals captured yet."
          />
          <ListBlock
            title="Stated gaps"
            items={unit.gaps}
            emptyLabel="No gaps captured."
            tone="amber"
          />
          <ListBlock
            title="Ambitions"
            items={unit.ambitions}
            emptyLabel="No ambitions captured."
          />
        </div>
      </div>
    </div>
  );
}
