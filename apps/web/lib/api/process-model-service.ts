import { apiFetch, API_BASE } from "@/lib/api/backend";
import { authHeaders } from "@/lib/auth/session";
import type {
  ProcessActor,
  ProcessMethod,
  ProcessMethodParam,
  ProcessModel,
} from "@/lib/types";

/**
 * Actor–Method process model API (Phase 1–3). API-only — this is a new,
 * Postgres-backed surface with no mock fallback (the page shows an empty state
 * when the backend is unreachable).
 */
export const processModelService = {
  get(engagementId: string, streamType: string): Promise<ProcessModel> {
    return apiFetch(`/api/v1/process-model/${engagementId}/${streamType}`);
  },

  /** On-demand full check of input + output variables against the ontology. */
  validate(
    engagementId: string,
    streamType: string,
  ): Promise<{
    valid: boolean;
    errors: number;
    warnings: number;
    problems: ProcessModel["problems"];
  }> {
    return apiFetch(
      `/api/v1/process-model/${engagementId}/${streamType}/validate`,
    );
  },

  seedFromBaseline(engagementId: string, streamType: string): Promise<ProcessModel> {
    return apiFetch(
      `/api/v1/process-model/${engagementId}/${streamType}/seed-from-baseline`,
      { method: "POST" },
    );
  },

  listActors(engagementId: string): Promise<ProcessActor[]> {
    return apiFetch(`/api/v1/process-model/actors?engagementId=${engagementId}`);
  },

  createActor(input: {
    name: string;
    functionUnit: string;
    kind?: string;
    engagementId?: string;
  }): Promise<ProcessActor> {
    return apiFetch(`/api/v1/process-model/actors`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listMethods(engagementId: string): Promise<ProcessMethod[]> {
    return apiFetch(`/api/v1/process-model/methods?engagementId=${engagementId}`);
  },

  createMethod(input: {
    actorId: string;
    name: string;
    engagementId?: string;
    params?: ProcessMethodParam[];
  }): Promise<ProcessMethod> {
    return apiFetch(`/api/v1/process-model/methods`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  addStep(
    engagementId: string,
    streamType: string,
    input: {
      methodId: string;
      label?: string;
      seq?: number;
      inputBindings?: Record<string, string>;
      outputBindings?: Record<string, string>;
    },
  ): Promise<ProcessModel> {
    return apiFetch(`/api/v1/process-model/${engagementId}/${streamType}/steps`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateStep(
    engagementId: string,
    streamType: string,
    stepId: string,
    patch: {
      seq?: number;
      label?: string;
      inputBindings?: Record<string, string>;
      outputBindings?: Record<string, string>;
    },
  ): Promise<ProcessModel> {
    return apiFetch(
      `/api/v1/process-model/${engagementId}/${streamType}/steps/${stepId}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
  },

  deleteStep(
    engagementId: string,
    streamType: string,
    stepId: string,
  ): Promise<ProcessModel> {
    return apiFetch(
      `/api/v1/process-model/${engagementId}/${streamType}/steps/${stepId}`,
      { method: "DELETE" },
    );
  },

  addGlobal(
    engagementId: string,
    streamType: string,
    input: {
      name: string;
      conceptUri: string;
      conceptLabel?: string;
      initialValue?: string;
    },
  ): Promise<ProcessModel> {
    return apiFetch(`/api/v1/process-model/${engagementId}/${streamType}/globals`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteGlobal(
    engagementId: string,
    streamType: string,
    globalId: string,
  ): Promise<ProcessModel> {
    return apiFetch(
      `/api/v1/process-model/${engagementId}/${streamType}/globals/${globalId}`,
      { method: "DELETE" },
    );
  },

  /** Generated BPMN (steps → diagram) as an XML string for the preview. */
  async fetchGeneratedBpmn(engagementId: string, streamType: string): Promise<string> {
    const response = await fetch(
      `${API_BASE}/api/v1/process-model/${engagementId}/${streamType}/bpmn`,
      { cache: "no-store", headers: { ...authHeaders() } },
    );
    if (!response.ok) {
      throw new Error(`Generated BPMN unavailable (${response.status})`);
    }
    return response.text();
  },
};
