"use client";

import { useState } from "react";
import { MessageSquarePlus, Target, Workflow } from "lucide-react";
import { FUNCTION_UNITS, FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { SYSTEM_MAP } from "@/lib/constants/systems";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type {
  AlignmentReport,
  Engagement,
  FunctionalUnit,
  TeleologyRow,
} from "@/lib/types";
import type { WorkshopStreamData, WorkshopTask } from "@/lib/workshop/types";
import { ScoreBadge } from "@/components/alignment/score-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function IntroSlide({
  engagement,
  streams,
}: {
  engagement: Engagement;
  streams: WorkshopStreamData[];
}): React.ReactNode {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">
        Stakeholder workshop
      </p>
      <h1 className="text-4xl font-semibold leading-tight">
        {engagement.client}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        {engagement.name}. Today we walk through your business processes and
        ontology, capture what should change, and compare where you are
        against where you want to be.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {streams.map((stream) => (
          <span
            key={stream.streamType}
            className="rounded-full border border-border px-3 py-1 text-sm"
          >
            {VALUE_STREAM_META[stream.streamType].label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StreamIntroSlide({
  stream,
}: {
  stream: WorkshopStreamData;
}): React.ReactNode {
  const meta = VALUE_STREAM_META[stream.streamType];
  const units = new Set(
    stream.tasks
      .map((task) => task.functionUnit)
      .filter((unit): unit is FunctionalUnit => Boolean(unit)),
  );
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-xl font-bold text-primary">
        {meta.shortLabel}
      </span>
      <h2 className="text-3xl font-semibold">{meta.label}</h2>
      <p className="max-w-xl text-lg text-muted-foreground">{meta.description}</p>
      <div className="flex gap-6 text-sm text-muted-foreground">
        <span>{stream.tasks.length} process steps</span>
        <span>{units.size} function units</span>
        <span>{stream.classes.length} ontology classes</span>
        <span className="capitalize">{stream.approvalStatus.replace("_", " ")}</span>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {[...units].map((unit) => {
          const unitMeta = FUNCTION_UNIT_MAP[unit];
          return (
            <span
              key={unit}
              className="flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-xs"
            >
              <span className={cn("size-2 rounded-full", unitMeta.dotClass)} />
              {unitMeta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface StepSlideProps {
  stream: WorkshopStreamData;
  task: WorkshopTask;
  stepIndex: number;
  canEdit: boolean;
  busy: boolean;
  onRetag: (taskId: string, unit: FunctionalUnit | undefined) => void;
  onComment: (taskId: string, taskName: string, body: string) => void;
}

export function StepSlide({
  stream,
  task,
  stepIndex,
  canEdit,
  busy,
  onRetag,
  onComment,
}: StepSlideProps): React.ReactNode {
  const [commentDraft, setCommentDraft] = useState("");
  const unitMeta = task.functionUnit
    ? FUNCTION_UNIT_MAP[task.functionUnit]
    : null;
  const linkedClasses = stream.classes.filter((cls) =>
    cls.linkedBpmnElements.includes(task.id),
  );
  const stepComments = stream.comments.filter(
    (comment) => comment.targetId === task.id && !comment.resolved,
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Step strip: where we are in the journey */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stream.tasks.map((item, index) => {
          const itemUnit = item.functionUnit
            ? FUNCTION_UNIT_MAP[item.functionUnit]
            : null;
          const active = index === stepIndex;
          return (
            <div
              key={item.id}
              className={cn(
                "flex h-2 min-w-6 flex-1 rounded-full transition-all",
                active
                  ? "h-3 ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-50",
                itemUnit?.dotClass ?? "bg-muted",
              )}
              title={item.name}
            />
          );
        })}
      </div>

      <div className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {VALUE_STREAM_META[stream.streamType].shortLabel} · step{" "}
          {stepIndex + 1} of {stream.tasks.length}
        </p>
        <h2 className="text-4xl font-semibold leading-tight">{task.name}</h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canEdit ? (
            <Select
              value={task.functionUnit ?? "unset"}
              onValueChange={(value) =>
                onRetag(
                  task.id,
                  value === "unset" ? undefined : (value as FunctionalUnit),
                )
              }
              disabled={busy}
            >
              <SelectTrigger size="sm" className="w-[220px]">
                <SelectValue placeholder="Assign function unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">No function unit</SelectItem>
                {FUNCTION_UNITS.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : unitMeta ? (
            <span className="flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 text-sm">
              <span className={cn("size-2 rounded-full", unitMeta.dotClass)} />
              {unitMeta.label}
            </span>
          ) : (
            <span className="text-sm text-amber-500">No function unit yet</span>
          )}
          {task.systems.length > 0 ? (
            task.systems.map((systemId) => (
              <span
                key={systemId}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
              >
                {SYSTEM_MAP[systemId]?.name ?? systemId}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/5 px-3 py-1 text-sm text-amber-500">
              No system — manual today
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Workflow className="size-4 text-muted-foreground" />
            Ontology concepts behind this step
          </div>
          {linkedClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ontology classes linked to this step yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {linkedClasses.map((cls) => (
                <li
                  key={cls.uri}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-sm"
                >
                  ◆ {cls.label}
                  {cls.supportsGoals.length > 0 ? (
                    <span className="ml-auto flex items-center gap-1 text-xs text-primary">
                      <Target className="size-3" />
                      supports {cls.supportsGoals.length} goal(s)
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquarePlus className="size-4 text-muted-foreground" />
            Stakeholder input on this step
          </div>
          {stepComments.length > 0 ? (
            <ul className="max-h-28 space-y-1 overflow-auto">
              {stepComments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-sm"
                >
                  <span className="font-medium">{comment.authorName}:</span>{" "}
                  {comment.body}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No open comments.</p>
          )}
          <div className="flex gap-2">
            <Textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Capture what the stakeholder says about this step…"
              className="min-h-16 flex-1 text-sm"
            />
          </div>
          <Button
            size="sm"
            disabled={busy || commentDraft.trim().length === 0}
            onClick={() => {
              onComment(task.id, task.name, commentDraft.trim());
              setCommentDraft("");
            }}
          >
            Capture
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OntologySlide({
  stream,
}: {
  stream: WorkshopStreamData;
}): React.ReactNode {
  const meta = VALUE_STREAM_META[stream.streamType];
  const grouped = new Map<string, typeof stream.classes>();
  for (const cls of stream.classes) {
    const key = cls.functionUnit ?? "__none__";
    grouped.set(key, [...(grouped.get(key) ?? []), cls]);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {meta.shortLabel} · ontology
        </p>
        <h2 className="text-3xl font-semibold">
          The language of {meta.label}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {stream.classes.length} concepts, grouped by owning function unit.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...grouped.entries()].map(([unitKey, classes]) => {
          const unitMeta =
            unitKey !== "__none__"
              ? FUNCTION_UNIT_MAP[unitKey as FunctionalUnit]
              : null;
          return (
            <div
              key={unitKey}
              className="space-y-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {unitMeta ? (
                  <>
                    <span
                      className={cn("size-2 rounded-full", unitMeta.dotClass)}
                    />
                    {unitMeta.label}
                  </>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {classes.length}
                </span>
              </div>
              <ul className="space-y-1">
                {classes.slice(0, 8).map((cls) => (
                  <li
                    key={cls.uri}
                    className="truncate rounded bg-muted/10 px-2 py-1 text-xs"
                  >
                    {cls.label}
                    {cls.linkedBpmnElements.length > 0 ? " · ⚙" : ""}
                    {cls.supportsGoals.length > 0 ? " · 🎯" : ""}
                  </li>
                ))}
                {classes.length > 8 ? (
                  <li className="px-2 py-1 text-xs text-muted-foreground">
                    +{classes.length - 8} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeleologyColumn({
  title,
  rows,
  field,
  tone,
}: {
  title: string;
  rows: TeleologyRow[];
  field: "goals" | "gaps" | "ambitions";
  tone?: "amber";
}): React.ReactNode {
  const items = rows.flatMap((row) =>
    row[field].map((value) => ({ value, functionUnit: row.functionUnit })),
  );
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None captured yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, index) => {
            const unitMeta = item.functionUnit
              ? FUNCTION_UNIT_MAP[item.functionUnit]
              : null;
            return (
              <li
                key={`${field}-${index}`}
                className={cn(
                  "flex items-start gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-sm",
                  tone === "amber" && "border-amber-500/30 bg-amber-500/5",
                )}
              >
                {unitMeta ? (
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      unitMeta.dotClass,
                    )}
                    title={unitMeta.label}
                  />
                ) : null}
                {item.value}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TeleologySlide({
  stream,
}: {
  stream: WorkshopStreamData;
}): React.ReactNode {
  const meta = VALUE_STREAM_META[stream.streamType];
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {meta.shortLabel} · teleology
        </p>
        <h2 className="text-3xl font-semibold">
          Where {meta.label} should go
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <TeleologyColumn title="Goals" rows={stream.teleologyRows} field="goals" />
        <TeleologyColumn
          title="Gaps today"
          rows={stream.teleologyRows}
          field="gaps"
          tone="amber"
        />
        <TeleologyColumn
          title="Ambitions"
          rows={stream.teleologyRows}
          field="ambitions"
        />
      </div>
    </div>
  );
}

export function WrapupSlide({
  alignment,
}: {
  alignment: AlignmentReport | null;
}): React.ReactNode {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 text-center">
      <h2 className="text-3xl font-semibold">Where we stand</h2>
      <p className="text-muted-foreground">
        Alignment of the current state against your teleology, per value
        stream. The gap-bridge agent turns the weak spots into concrete
        solution options after this session.
      </p>
      {alignment ? (
        <div className="space-y-2">
          {alignment.streams.map((stream) => {
            const streamWide = stream.units.find(
              (unit) => unit.functionUnit === null,
            );
            return (
              <div
                key={stream.streamType}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
              >
                <span className="font-medium">
                  {VALUE_STREAM_META[stream.streamType].label}
                </span>
                <ScoreBadge score={streamWide?.score ?? 0} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Alignment report unavailable (API offline).
        </p>
      )}
    </div>
  );
}
