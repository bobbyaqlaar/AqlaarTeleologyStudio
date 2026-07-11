import { apiFetch } from "@/lib/api/backend";
import type { Initiative, SolutionOption, ValueStreamType } from "@/lib/types";

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

export interface BridgeGapsResult {
  engagementId: string;
  streamType: ValueStreamType;
  options: SolutionOption[];
  source: "claude" | "openrouter";
}

export interface DraftInitiativesResult {
  engagementId: string;
  initiatives: Initiative[];
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

  bridgeGaps(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<BridgeGapsResult> {
    return apiFetch<BridgeGapsResult>(
      `/api/v1/agents/${engagementId}/${streamType}/bridge-gaps`,
      { method: "POST" },
    );
  },

  draftInitiatives(engagementId: string): Promise<DraftInitiativesResult> {
    return apiFetch<DraftInitiativesResult>(
      `/api/v1/agents/${engagementId}/draft-initiatives`,
      { method: "POST" },
    );
  },
};
