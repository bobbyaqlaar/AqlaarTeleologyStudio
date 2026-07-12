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
  AiTagSuggestion,
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

  async applySuggestion(
    engagementId: string,
    streamType: ValueStreamType,
    elementId: string,
    suggestion: Pick<AiTagSuggestion, "functionUnit" | "systems">,
  ): Promise<ProcessState> {
    try {
      const state = await apiFetch<ProcessState>(
        `/api/v1/process/${engagementId}/${streamType}/elements/${elementId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            functionUnit: suggestion.functionUnit,
            systems: suggestion.systems,
            aiSuggestion: null,
          }),
        },
      );
      return saveProcessState(state);
    } catch {
      const state = await loadProcessState(engagementId, streamType);
      state.elementMeta[elementId] = {
        ...state.elementMeta[elementId],
        functionUnit: suggestion.functionUnit,
        systems:
          suggestion.systems.length > 0 ? suggestion.systems : undefined,
        aiSuggestion: undefined,
      };
      return saveProcessState(state);
    }
  },

  async dismissSuggestion(
    engagementId: string,
    streamType: ValueStreamType,
    elementId: string,
  ): Promise<ProcessState> {
    try {
      const state = await apiFetch<ProcessState>(
        `/api/v1/process/${engagementId}/${streamType}/elements/${elementId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ aiSuggestion: null }),
        },
      );
      return saveProcessState(state);
    } catch {
      const state = await loadProcessState(engagementId, streamType);
      const entry = { ...state.elementMeta[elementId] };
      delete entry.aiSuggestion;
      state.elementMeta[elementId] = entry;
      return saveProcessState(state);
    }
  },

  saveMeta(state: ProcessState): Promise<ProcessState> {
    return Promise.resolve(saveProcessState(state));
  },

  listTasks(engagementId: string, streamType: ValueStreamType) {
    return Promise.resolve(getTaskSummaries(engagementId, streamType));
  },
};

/** Postgres-backed via FastAPI; mock fallback for UI-only mode. */
export const commentService = {
  async list(
    engagementId: string,
    streamType: ValueStreamType,
    targetId?: string,
  ): Promise<ProcessComment[]> {
    try {
      const params = targetId ? `?targetId=${encodeURIComponent(targetId)}` : "";
      return await apiFetch<ProcessComment[]>(
        `/api/v1/comments/${engagementId}/${streamType}${params}`,
      );
    } catch {
      return listProcessComments(engagementId, streamType, targetId);
    }
  },

  async listOpen(engagementId: string): Promise<ProcessComment[]> {
    try {
      return await apiFetch<ProcessComment[]>(
        `/api/v1/comments/${engagementId}/open`,
      );
    } catch {
      const { listOpenProcessComments } = await import(
        "@/lib/mock/process-store"
      );
      return listOpenProcessComments(engagementId);
    }
  },

  async add(
    input: Omit<ProcessComment, "id" | "createdAt">,
  ): Promise<ProcessComment> {
    try {
      return await apiFetch<ProcessComment>("/api/v1/comments", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch {
      return addProcessComment(input);
    }
  },

  async resolve(commentId: string): Promise<ProcessComment | null> {
    try {
      return await apiFetch<ProcessComment>(
        `/api/v1/comments/${commentId}/resolve`,
        { method: "POST" },
      );
    } catch {
      const { resolveProcessComment } = await import(
        "@/lib/mock/process-store"
      );
      return resolveProcessComment(commentId) ?? null;
    }
  },
};

async function analyzeGaps(
  engagementId: string,
  streamType: ValueStreamType,
): Promise<AiGapSuggestion[]> {
  try {
    const result = await apiFetch<{ suggestions: AiGapSuggestion[] }>(
      `/api/v1/gaps/${engagementId}/${streamType}/analyze`,
      { method: "POST" },
    );
    return result.suggestions;
  } catch {
    return analyzeProcessGaps(engagementId, streamType);
  }
}

/** Live gap analysis via the API (Claude-backed when the server has
 * Anthropic credentials, heuristics otherwise); local heuristics fallback
 * when the API is unreachable. */
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
            void analyzeGaps(engagementId, streamType).then(resolve);
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
    return analyzeGaps(engagementId, streamType);
  },
};
