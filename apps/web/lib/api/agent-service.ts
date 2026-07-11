import { apiFetch } from "@/lib/api/backend";
import type { ValueStreamType } from "@/lib/types";

export interface DraftTeleologyResult {
  engagementId: string;
  streamType: ValueStreamType;
  rows: Array<{
    id: string;
    functionUnit: string | null;
    action: "created" | "updated" | "skipped_not_draft";
  }>;
  source: "claude" | "openrouter";
}

/** Phase 2 drafting agents. API-only — agents have no mock fallback; the
 * caller surfaces failures so the consultant knows nothing was drafted. */
export const agentService = {
  draftTeleology(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<DraftTeleologyResult> {
    return apiFetch<DraftTeleologyResult>(
      `/api/v1/agents/${engagementId}/${streamType}/draft-teleology`,
      { method: "POST" },
    );
  },
};
