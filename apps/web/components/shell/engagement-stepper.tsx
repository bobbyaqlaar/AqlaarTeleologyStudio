"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { WORKFLOW_STEPS } from "@/lib/constants/navigation";
import { engagementService } from "@/lib/mock/services/engagement-service";
import type { EngagementProgress, WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EngagementStepperProps {
  engagementId: string;
  currentStep: WorkflowStep;
}

function stepHref(
  engagementId: string,
  step: WorkflowStep,
  firstLoadedStream: string | null,
): string {
  const stream = firstLoadedStream ?? "o2c";
  switch (step) {
    case "streams":
      return `/engagements/${engagementId}/streams`;
    case "process":
      return `/engagements/${engagementId}/streams/${stream}/process`;
    case "ontology":
      return `/engagements/${engagementId}/streams/${stream}/ontology`;
    case "teleology":
      return `/engagements/${engagementId}/teleology`;
    case "connectors":
      return `/engagements/${engagementId}/connectors`;
    case "review":
      return `/engagements/${engagementId}/review`;
    default:
      return `/engagements/${engagementId}`;
  }
}

export function EngagementStepper({
  engagementId,
  currentStep,
}: EngagementStepperProps): React.ReactNode {
  const [progress, setProgress] = useState<EngagementProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void engagementService.getProgress(engagementId).then((data) => {
      if (!cancelled) {
        setProgress(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [engagementId, currentStep]);

  const streamsLoaded = progress?.streams ?? false;

  return (
    <ol
      aria-label="Engagement progress"
      className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1"
    >
      {WORKFLOW_STEPS.map((item, index) => {
        // Completion comes from real artefact state, never from position.
        const isComplete = progress ? progress[item.step] : false;
        const isCurrent = item.step === currentStep;
        // Streams is always reachable; process/ontology/teleology need a
        // loaded baseline; connectors (optional) and review are always open.
        const enabled =
          item.step === "streams" ||
          item.step === "connectors" ||
          item.step === "review" ||
          streamsLoaded ||
          isCurrent;

        return (
          <li key={item.step} className="flex shrink-0 items-center gap-2">
            {index > 0 ? (
              <div
                className={cn(
                  "hidden h-px w-6 sm:block md:w-10",
                  isComplete || isCurrent ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            {enabled ? (
              <Link
                href={stepHref(
                  engagementId,
                  item.step,
                  progress?.firstLoadedStream ?? null,
                )}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors",
                  isCurrent && "bg-primary/10 ring-1 ring-primary/30",
                  !isCurrent && "hover:bg-muted/60",
                )}
              >
                <StepCircle
                  number={item.number}
                  isComplete={isComplete}
                  isCurrent={isCurrent}
                />
                <span
                  className={cn(
                    "hidden text-xs font-medium md:inline",
                    !isCurrent && !isComplete && "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            ) : (
              <div
                className="flex items-center gap-2 px-2 py-1 opacity-50"
                title="Load a value stream baseline first"
              >
                <StepCircle
                  number={item.number}
                  isComplete={false}
                  isCurrent={false}
                />
                <span className="hidden text-xs font-medium text-muted-foreground md:inline">
                  {item.label}
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepCircle({
  number,
  isComplete,
  isCurrent,
}: {
  number: number;
  isComplete: boolean;
  isCurrent: boolean;
}): React.ReactNode {
  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
        isComplete && "border-primary bg-primary text-primary-foreground",
        isCurrent &&
          !isComplete &&
          "border-primary bg-background text-primary ring-2 ring-primary/30",
        !isComplete &&
          !isCurrent &&
          "border-border bg-muted text-muted-foreground",
      )}
    >
      {isComplete ? <Check className="size-3.5" /> : number}
    </span>
  );
}
