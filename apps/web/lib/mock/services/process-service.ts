import {
  addProcessComment,
  analyzeProcessGaps,
  ensureProcessState,
  getTaskSummaries,
  listProcessComments,
  saveBpmnXml,
  saveProcessState,
  setElementFunctionUnit,
} from "@/lib/mock/process-store";
import type {
  AiGapSuggestion,
  FunctionalUnit,
  ProcessComment,
  ProcessState,
  ValueStreamType,
} from "@/lib/types";

export const processService = {
  load(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<ProcessState> {
    return Promise.resolve(ensureProcessState(engagementId, streamType));
  },

  saveXml(
    engagementId: string,
    streamType: ValueStreamType,
    bpmnXml: string,
  ): Promise<ProcessState> {
    return Promise.resolve(saveBpmnXml(engagementId, streamType, bpmnXml));
  },

  setFunctionUnit(
    engagementId: string,
    streamType: ValueStreamType,
    elementId: string,
    functionUnit: FunctionalUnit | undefined,
  ): Promise<ProcessState> {
    return Promise.resolve(
      setElementFunctionUnit(
        engagementId,
        streamType,
        elementId,
        functionUnit,
      ),
    );
  },

  saveMeta(state: ProcessState): Promise<ProcessState> {
    return Promise.resolve(saveProcessState(state));
  },

  listTasks(engagementId: string, streamType: ValueStreamType) {
    return Promise.resolve(getTaskSummaries(engagementId, streamType));
  },
};

export const commentService = {
  list(
    engagementId: string,
    streamType: ValueStreamType,
    targetId?: string,
  ): Promise<ProcessComment[]> {
    return Promise.resolve(
      listProcessComments(engagementId, streamType, targetId),
    );
  },

  add(
    input: Omit<ProcessComment, "id" | "createdAt">,
  ): Promise<ProcessComment> {
    return Promise.resolve(addProcessComment(input));
  },
};

export const aiGapService = {
  analyzeDebounced: (() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    return (
      engagementId: string,
      streamType: ValueStreamType,
    ): Promise<AiGapSuggestion[]> => {
      const key = `${engagementId}:${streamType}`;

      return new Promise((resolve) => {
        const existing = timers.get(key);
        if (existing) {
          clearTimeout(existing);
        }

        timers.set(
          key,
          setTimeout(() => {
            resolve(analyzeProcessGaps(engagementId, streamType));
            timers.delete(key);
          }, 600),
        );
      });
    };
  })(),

  analyze(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<AiGapSuggestion[]> {
    return Promise.resolve(analyzeProcessGaps(engagementId, streamType));
  },
};
