import { BASELINE_TEMPLATES } from "@/lib/constants/value-streams";
import { getEngagementById, loadBaselineForStream } from "@/lib/mock/store";
import type { BaselineTemplate, Engagement, ValueStreamType } from "@/lib/types";

export const streamService = {
  listBaselines(): Promise<BaselineTemplate[]> {
    return Promise.resolve(BASELINE_TEMPLATES);
  },

  getBaseline(streamType: ValueStreamType): Promise<BaselineTemplate | null> {
    const baseline =
      BASELINE_TEMPLATES.find((item) => item.streamType === streamType) ?? null;
    return Promise.resolve(baseline);
  },

  loadBaseline(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<Engagement | null> {
    return Promise.resolve(
      loadBaselineForStream(engagementId, streamType) ?? null,
    );
  },

  getEngagementStreams(engagementId: string): Promise<Engagement | null> {
    return Promise.resolve(getEngagementById(engagementId) ?? null);
  },
};
