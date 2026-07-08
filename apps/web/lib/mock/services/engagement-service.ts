import { apiFetch } from "@/lib/api/backend";
import {
  addEngagement,
  getEngagementById,
  getEngagementsSnapshot,
} from "@/lib/mock/store";
import type { CreateEngagementInput, Engagement } from "@/lib/types";

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
};
