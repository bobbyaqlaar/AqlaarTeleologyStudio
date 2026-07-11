import { apiFetch } from "@/lib/api/backend";
import type { AlignmentReport } from "@/lib/types";

/** Current-state vs teleology alignment report. API-only — the join across
 * Postgres and Fuseki has no meaningful mock, so failures surface to the
 * caller and the view shows its offline state. */
export const alignmentService = {
  getReport(engagementId: string): Promise<AlignmentReport> {
    return apiFetch<AlignmentReport>(`/api/v1/alignment/${engagementId}`);
  },
};
