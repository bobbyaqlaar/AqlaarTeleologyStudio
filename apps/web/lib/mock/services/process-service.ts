import { apiFetch } from "@/lib/api/backend";
import {
  addProcessComment,
  analyzeProcessGaps,
  getTaskSummaries,
  listProcessComments,
  loadProcessState,
  saveBpmnXml,
  saveProcessState,
  setElementFunctionUnit,
  setElementSystems,
} from "@/lib/mock/process-store";
import type {
  AiGapSuggestion,
  FunctionalUnit,
  ProcessComment,
  ProcessState,
  ValueStreamType,
} from "@/lib/types";

/** Postgres-backed via FastAPI; each call falls back to the in-memory mock
 * store when the API is unreachable. Successful API responses are mirrored
 * into the mock store so sync helpers (task lists, gap analysis) see them. */
export const processService = {
  async load(
    engagementId: string,
    streamType: ValueStreamType,
    industry?: string,
  ): Promise<ProcessState> {
    try {
      const state = await apiFetch<ProcessState>(
        `/api/v1/process/${engagementId}/${streamType}`,
      );
      return saveProcessState(state);
    } catch {
      return loadProcessState(engagementId, streamType, industry);
    }
  },

  async saveXml(
    engagementId: string,
    streamType: ValueStreamType,
    bpmnXml: string,
  ): Promise<ProcessState> {
    try {
      const state = await apiFetch<ProcessState>(
        `/api/v1/process/${engagementId}/${streamType}`,
        { method: "PUT", body: JSON.stringify({ bpmnXml }) },
      );
      return saveProcessState(state);
    } catch {
      return saveBpmnXml(engagementId, streamType, bpmnXml);
    }
  },

  async setFunctionUnit(
    engagementId: string,
    streamType: ValueStreamType,
    elementId: string,
    functionUnit: FunctionalUnit | undefined,
  ): Promise<ProcessState> {
    try {
      const state = await apiFetch<ProcessState>(
        `/api/v1/process/${engagementId}/${streamType}/elements/${elementId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ functionUnit: functionUnit ?? null }),
        },
      );
      return saveProcessState(state);
    } catch {
      return setElementFunctionUnit(
        engagementId,
        streamType,
        elementId,
        functionUnit,
      );
    }
  },

  async setSystems(
    engagementId: string,
    streamType: ValueStreamType,
    elementId: string,
    systems: string[],
  ): Promise<ProcessState> {
    try {
      const state = await apiFetch<ProcessState>(
        `/api/v1/process/${engagementId}/${streamType}/elements/${elementId}`,
        { method: "PATCH", body: JSON.stringify({ systems }) },
      );
      return saveProcessState(state);
    } catch {
      return setElementSystems(engagementId, streamType, elementId, systems);
    }
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
