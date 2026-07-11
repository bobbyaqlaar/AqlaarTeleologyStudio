import type {
  AlignmentReport,
  OwlClass,
  ProcessComment,
  TeleologyRow,
  ValueStreamType,
} from "@/lib/types";
import type { FunctionalUnit } from "@/lib/types";

export interface WorkshopTask {
  id: string;
  name: string;
  functionUnit?: FunctionalUnit;
  systems: string[];
}

export interface WorkshopStreamData {
  streamType: ValueStreamType;
  approvalStatus: string;
  tasks: WorkshopTask[];
  classes: OwlClass[];
  teleologyRows: TeleologyRow[];
  comments: ProcessComment[];
}

export type WorkshopSlide =
  | { kind: "intro" }
  | { kind: "stream-intro"; streamType: ValueStreamType }
  | {
      kind: "step";
      streamType: ValueStreamType;
      taskId: string;
      stepIndex: number;
      stepTotal: number;
    }
  | { kind: "ontology"; streamType: ValueStreamType }
  | { kind: "teleology"; streamType: ValueStreamType }
  | { kind: "wrapup" };

export interface WorkshopData {
  streams: WorkshopStreamData[];
  alignment: AlignmentReport | null;
}

export function buildSlides(data: WorkshopData): WorkshopSlide[] {
  const slides: WorkshopSlide[] = [{ kind: "intro" }];
  for (const stream of data.streams) {
    slides.push({ kind: "stream-intro", streamType: stream.streamType });
    stream.tasks.forEach((task, index) => {
      slides.push({
        kind: "step",
        streamType: stream.streamType,
        taskId: task.id,
        stepIndex: index,
        stepTotal: stream.tasks.length,
      });
    });
    slides.push({ kind: "ontology", streamType: stream.streamType });
    slides.push({ kind: "teleology", streamType: stream.streamType });
  }
  slides.push({ kind: "wrapup" });
  return slides;
}

export function slideLabel(slide: WorkshopSlide): string {
  switch (slide.kind) {
    case "intro":
      return "Welcome";
    case "stream-intro":
      return "Stream overview";
    case "step":
      return `Step ${slide.stepIndex + 1}/${slide.stepTotal}`;
    case "ontology":
      return "Ontology";
    case "teleology":
      return "Teleology";
    case "wrapup":
      return "Alignment wrap-up";
  }
}
