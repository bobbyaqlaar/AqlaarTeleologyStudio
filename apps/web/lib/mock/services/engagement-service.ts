import { apiFetch } from "@/lib/api/backend";
import {
  addEngagement,
  getEngagementById,
  getEngagementsSnapshot,
  removeEngagement,
} from "@/lib/mock/store";
import type {
  CreateEngagementInput,
  Engagement,
  EngagementProgress,
} from "@/lib/types";

/** Postgres-backed via FastAPI; falls back to the in-memory mock store when
 * the API is unreachable (UI-only dev mode). */
export const engagementService = {
  async list(): Promise<Engagement[]> {
    try {
      return await apiFetch<Engagement[]>("/api/v1/engagements");
    } catch {
      return getEngagementsSnapshot();
    }
  },

  async get(id: string): Promise<Engagement | null> {
    try {
      return await apiFetch<Engagement>(`/api/v1/engagements/${id}`);
    } catch {
      return getEngagementById(id) ?? null;
    }
  },

  async create(input: CreateEngagementInput): Promise<Engagement> {
    try {
      return await apiFetch<Engagement>("/api/v1/engagements", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch {
      return addEngagement(input);
    }
  },

  /** Per-step completion for the stepper. Mock fallback can only derive the
   * streams/review signals from the engagement object. */
  async getProgress(id: string): Promise<EngagementProgress> {
    try {
      return await apiFetch<EngagementProgress>(
        `/api/v1/engagements/${id}/progress`,
      );
    } catch {
      const engagement = getEngagementById(id) ?? null;
      const loaded =
        engagement?.valueStreams.filter((s) => s.baselineLoaded) ?? [];
      return {
        streams: loaded.length > 0,
        process: false,
        ontology: false,
        teleology: false,
        connectors: false,
        review:
          loaded.length > 0 &&
          loaded.every((s) => s.approvalStatus === "approved"),
        firstLoadedStream: loaded[0]?.type ?? null,
      };
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await apiFetch<void>(`/api/v1/engagements/${id}`, { method: "DELETE" });
    } catch {
      removeEngagement(id);
    }
  },
};
