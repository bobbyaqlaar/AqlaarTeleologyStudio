import {
  addEngagement,
  getEngagementById,
  getEngagementsSnapshot,
} from "@/lib/mock/store";
import type { CreateEngagementInput, Engagement } from "@/lib/types";

export const engagementService = {
  list(): Promise<Engagement[]> {
    return Promise.resolve(getEngagementsSnapshot());
  },

  get(id: string): Promise<Engagement | null> {
    return Promise.resolve(getEngagementById(id) ?? null);
  },

  create(input: CreateEngagementInput): Promise<Engagement> {
    return Promise.resolve(addEngagement(input));
  },
};
