"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  X,
} from "lucide-react";
import { alignmentService } from "@/lib/api/alignment-service";
import { ontologyService } from "@/lib/api/ontology-service";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { useRole } from "@/lib/context/role-context";
import {
  commentService,
  processService,
} from "@/lib/mock/services/process-service";
import { teleologyService } from "@/lib/mock/services/teleology-service";
import { extractTasksFromXml } from "@/lib/mock/process-store";
import type {
  AlignmentReport,
  Engagement,
  FunctionalUnit,
  ProcessComment,
  ValueStreamType,
} from "@/lib/types";
import {
  buildSlides,
  slideLabel,
  type WorkshopSlide,
  type WorkshopStreamData,
} from "@/lib/workshop/types";
import { ParkingLotPanel } from "@/components/workshop/parking-lot-panel";
import {
  IntroSlide,
  OntologySlide,
  StepSlide,
  StreamIntroSlide,
  TeleologySlide,
  WrapupSlide,
} from "@/components/workshop/workshop-slides";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PARKING_LOT_TARGET = "workshop-parking-lot";

interface WorkshopWorkspaceProps {
  engagement: Engagement;
}

export function WorkshopWorkspace({
  engagement,
}: WorkshopWorkspaceProps): React.ReactNode {
  const { role, canEdit } = useRole();
  const [streams, setStreams] = useState<WorkshopStreamData[]>([]);
  const [alignment, setAlignment] = useState<AlignmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [showParkingLot, setShowParkingLot] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadedStreamTypes = useMemo(
    () =>
      engagement.valueStreams
        .filter((stream) => stream.baselineLoaded)
        .map((stream) => stream.type),
    [engagement],
  );

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);

    const teleology = await teleologyService
      .getMatrix(engagement.id)
      .catch(() => null);

    const streamData = await Promise.all(
      loadedStreamTypes.map(
        async (streamType): Promise<WorkshopStreamData> => {
          const [state, graph, comments] = await Promise.all([
            processService.load(engagement.id, streamType, engagement.industry),
            ontologyService
              .getGraph(engagement.id, streamType)
              .catch(() => null),
            commentService.list(engagement.id, streamType).catch(() => []),
          ]);
          const tasks = extractTasksFromXml(state.bpmnXml).map((task) => {
            const meta = state.elementMeta[task.id] ?? {};
            return {
              id: task.id,
              name: task.name,
              functionUnit: meta.functionUnit,
              systems: meta.systems ?? [],
            };
          });
          return {
            streamType,
            approvalStatus:
              engagement.valueStreams.find((s) => s.type === streamType)
                ?.approvalStatus ?? "draft",
            tasks,
            classes: graph?.classes ?? [],
            teleologyRows:
              teleology?.rows.filter(
                (row) => row.streamType === streamType,
              ) ?? [],
            comments,
          };
        },
      ),
    );

    setStreams(streamData);
    setAlignment(
      await alignmentService.getReport(engagement.id).catch(() => null),
    );
    setLoading(false);
  }, [engagement, loadedStreamTypes]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const slides = useMemo(
    () => buildSlides({ streams, alignment }),
    [streams, alignment],
  );
  const slide = slides[Math.min(slideIndex, slides.length - 1)];

  const goTo = useCallback(
    (index: number): void => {
      setSlideIndex(Math.max(0, Math.min(index, slides.length - 1)));
    },
    [slides.length],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" || target.tagName === "INPUT")
      ) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setSlideIndex((current) => Math.min(current + 1, slides.length - 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSlideIndex((current) => Math.max(current - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length]);

  const activeStreamType: ValueStreamType | null =
    slide && "streamType" in slide ? slide.streamType : null;

  const parkingLotNotes: ProcessComment[] = useMemo(
    () =>
      streams
        .flatMap((stream) => stream.comments)
        .filter((comment) => comment.targetId === PARKING_LOT_TARGET)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [streams],
  );

  const applyComment = (comment: ProcessComment): void => {
    setStreams((current) =>
      current.map((stream) =>
        stream.streamType === comment.streamType
          ? { ...stream, comments: [...stream.comments, comment] }
          : stream,
      ),
    );
  };

  const handleAddParkingNote = async (body: string): Promise<void> => {
    const streamType = activeStreamType ?? loadedStreamTypes[0];
    if (!streamType) {
      return;
    }
    setBusy(true);
    try {
      const comment = await commentService.add({
        engagementId: engagement.id,
        streamType,
        authorId:
          role === "stakeholder" ? "user-stakeholder-1" : "user-consultant-1",
        authorName: role === "stakeholder" ? "Jordan Lee" : "Alex Morgan",
        role,
        targetType: "bpmn_element",
        targetId: PARKING_LOT_TARGET,
        targetLabel: "Workshop parking lot",
        body,
        resolved: false,
      });
      applyComment(comment);
    } catch {
      // note stays in the textarea if persistence failed
    }
    setBusy(false);
  };

  const handleStepComment = async (
    taskId: string,
    taskName: string,
    body: string,
  ): Promise<void> => {
    if (!activeStreamType) {
      return;
    }
    setBusy(true);
    try {
      const comment = await commentService.add({
        engagementId: engagement.id,
        streamType: activeStreamType,
        authorId:
          role === "stakeholder" ? "user-stakeholder-1" : "user-consultant-1",
        authorName: role === "stakeholder" ? "Jordan Lee" : "Alex Morgan",
        role,
        targetType: "bpmn_element",
        targetId: taskId,
        targetLabel: taskName,
        body,
        resolved: false,
      });
      applyComment(comment);
    } catch {
      // surface silently; slide keeps prior comments
    }
    setBusy(false);
  };

  const handleRetag = async (
    taskId: string,
    unit: FunctionalUnit | undefined,
  ): Promise<void> => {
    if (!activeStreamType || !canEdit) {
      return;
    }
    setBusy(true);
    try {
      await processService.setFunctionUnit(
        engagement.id,
        activeStreamType,
        taskId,
        unit,
      );
      setStreams((current) =>
        current.map((stream) =>
          stream.streamType === activeStreamType
            ? {
                ...stream,
                tasks: stream.tasks.map((task) =>
                  task.id === taskId ? { ...task, functionUnit: unit } : task,
                ),
              }
            : stream,
        ),
      );
    } catch {
      // retag failed — keep previous tag
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">
          Preparing workshop session…
        </p>
      </div>
    );
  }

  if (loadedStreamTypes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <p className="font-medium">Nothing to present yet</p>
          <p className="text-sm text-muted-foreground">
            Load at least one value stream baseline before running a workshop.
          </p>
          <Link
            href={`/engagements/${engagement.id}/streams`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Go to value streams
          </Link>
        </div>
      </div>
    );
  }

  const currentStream = activeStreamType
    ? (streams.find((stream) => stream.streamType === activeStreamType) ??
      null)
    : null;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <p className="text-sm font-medium">{engagement.client}</p>
        <span className="text-xs text-muted-foreground">
          Workshop · {slideLabel(slide)}
          {activeStreamType
            ? ` · ${VALUE_STREAM_META[activeStreamType].shortLabel}`
            : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {slideIndex + 1} / {slides.length}
          </span>
          <Button
            size="sm"
            variant={showParkingLot ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setShowParkingLot((value) => !value)}
          >
            <NotebookPen className="size-4" />
            Parking lot
            {parkingLotNotes.length > 0 ? ` (${parkingLotNotes.length})` : ""}
          </Button>
          <Link
            href={`/engagements/${engagement.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5",
            )}
          >
            <X className="size-4" />
            Exit
          </Link>
        </div>
      </header>

      {/* Progress strip */}
      <div className="flex h-1 shrink-0">
        {slides.map((item, index) => (
          <button
            key={`${item.kind}-${index}`}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            className={cn(
              "flex-1 transition-colors",
              index <= slideIndex ? "bg-primary" : "bg-muted",
            )}
            onClick={() => goTo(index)}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Agenda rail */}
        <aside className="hidden w-56 shrink-0 overflow-auto border-r border-border p-3 lg:block">
          <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Agenda
          </p>
          <ul className="space-y-0.5">
            {slides.map((item, index) => {
              const active = index === slideIndex;
              const label =
                item.kind === "step"
                  ? (streams
                      .find(
                        (s) =>
                          "streamType" in item &&
                          s.streamType === item.streamType,
                      )
                      ?.tasks.find((t) => t.id === item.taskId)?.name ??
                    slideLabel(item))
                  : item.kind === "stream-intro"
                    ? VALUE_STREAM_META[item.streamType].label
                    : slideLabel(item);
              return (
                <li key={`agenda-${index}`}>
                  <button
                    type="button"
                    className={cn(
                      "w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/40",
                      item.kind === "step" && "pl-5",
                    )}
                    onClick={() => goTo(index)}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Stage */}
        <main className="flex min-w-0 flex-1 items-center justify-center overflow-auto p-6 lg:p-10">
          {slide.kind === "intro" ? (
            <IntroSlide engagement={engagement} streams={streams} />
          ) : null}
          {slide.kind === "stream-intro" && currentStream ? (
            <StreamIntroSlide stream={currentStream} />
          ) : null}
          {slide.kind === "step" && currentStream ? (
            (() => {
              const task = currentStream.tasks.find(
                (item) => item.id === slide.taskId,
              );
              return task ? (
                <StepSlide
                  stream={currentStream}
                  task={task}
                  stepIndex={slide.stepIndex}
                  canEdit={canEdit}
                  busy={busy}
                  onRetag={(taskId, unit) => void handleRetag(taskId, unit)}
                  onComment={(taskId, taskName, body) =>
                    void handleStepComment(taskId, taskName, body)
                  }
                />
              ) : null;
            })()
          ) : null}
          {slide.kind === "ontology" && currentStream ? (
            <OntologySlide stream={currentStream} />
          ) : null}
          {slide.kind === "teleology" && currentStream ? (
            <TeleologySlide stream={currentStream} />
          ) : null}
          {slide.kind === "wrapup" ? (
            <WrapupSlide alignment={alignment} />
          ) : null}
        </main>

        {/* Parking lot rail */}
        {showParkingLot ? (
          <aside className="w-80 shrink-0 overflow-hidden border-l border-border p-3">
            <ParkingLotPanel
              notes={parkingLotNotes}
              busy={busy}
              onAdd={(body) => void handleAddParkingNote(body)}
            />
          </aside>
        ) : null}
      </div>

      {/* Bottom navigation */}
      <footer className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={slideIndex === 0}
          onClick={() => goTo(slideIndex - 1)}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <p className="text-xs text-muted-foreground">
          Use ← → arrow keys to navigate
        </p>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={slideIndex === slides.length - 1}
          onClick={() => goTo(slideIndex + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </footer>
    </div>
  );
}
