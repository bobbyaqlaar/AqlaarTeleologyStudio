"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { WORKFLOW_STEPS } from "@/lib/constants/navigation";
import type { WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EngagementStepperProps {
  engagementId: string;
  currentStep: WorkflowStep;
}

function stepHref(engagementId: string, step: WorkflowStep): string {
  switch (step) {
    case "streams":
      return `/engagements/${engagementId}/streams`;
    case "process":
      return `/engagements/${engagementId}/streams/o2c/process`;
    case "ontology":
      return `/engagements/${engagementId}/streams/o2c/ontology`;
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
  const currentIndex = WORKFLOW_STEPS.findIndex(
    (item) => item.step === currentStep,
  );

  return (
    <ol
      aria-label="Engagement progress"
      className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1"
    >
      {WORKFLOW_STEPS.map((item, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = item.step === currentStep;
        const isUpcoming = index > currentIndex;
        const enabled = index <= currentIndex || item.step === "streams";

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
                href={stepHref(engagementId, item.step)}
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
                    isUpcoming && "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1 opacity-50">
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
