import { apiFetch } from "@/lib/api/backend";
import { BASELINE_TEMPLATES } from "@/lib/constants/value-streams";
import { engagementService } from "@/lib/mock/services/engagement-service";
import { loadBaselineForStream } from "@/lib/mock/store";
import type { BaselineTemplate, Engagement, ValueStreamType } from "@/lib/types";

/** Postgres-backed via FastAPI; mock-store fallback for UI-only mode. */
export const streamService = {
  listBaselines(): Promise<BaselineTemplate[]> {
    return Promise.resolve(BASELINE_TEMPLATES);
  },

  getBaseline(streamType: ValueStreamType): Promise<BaselineTemplate | null> {
    const baseline =
      BASELINE_TEMPLATES.find((item) => item.streamType === streamType) ?? null;
    return Promise.resolve(baseline);
  },

  async loadBaseline(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<Engagement | null> {
    try {
      return await apiFetch<Engagement>(
        `/api/v1/engagements/${engagementId}/streams/${streamType}/load-baseline`,
        { method: "POST" },
      );
    } catch {
      return loadBaselineForStream(engagementId, streamType) ?? null;
    }
  },

  getEngagementStreams(engagementId: string): Promise<Engagement | null> {
    return engagementService.get(engagementId);
  },
};
