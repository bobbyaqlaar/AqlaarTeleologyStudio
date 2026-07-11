import { apiFetch } from "@/lib/api/backend";
import type {
  Initiative,
  SolutionOption,
  SolutionStatus,
  ValueStreamType,
} from "@/lib/types";

/** Solution options + initiative candidates drafted by the gap-bridge
 * agents. API-only — no mock fallback. */
export const solutionsService = {
  listOptions(
    engagementId: string,
    streamType?: ValueStreamType,
  ): Promise<SolutionOption[]> {
    const query = streamType ? `?stream_type=${streamType}` : "";
    return apiFetch<SolutionOption[]>(
      `/api/v1/solutions/${engagementId}/options${query}`,
    );
  },

  setOptionStatus(
    engagementId: string,
    optionId: string,
    status: SolutionStatus,
  ): Promise<SolutionOption> {
    return apiFetch<SolutionOption>(
      `/api/v1/solutions/${engagementId}/options/${optionId}/status`,
      { method: "POST", body: JSON.stringify({ status }) },
    );
  },

  listInitiatives(engagementId: string): Promise<Initiative[]> {
    return apiFetch<Initiative[]>(
      `/api/v1/solutions/${engagementId}/initiatives`,
    );
  },

  setInitiativeStatus(
    engagementId: string,
    initiativeId: string,
    status: SolutionStatus,
  ): Promise<Initiative> {
    return apiFetch<Initiative>(
      `/api/v1/solutions/${engagementId}/initiatives/${initiativeId}/status`,
      { method: "POST", body: JSON.stringify({ status }) },
    );
  },
};
