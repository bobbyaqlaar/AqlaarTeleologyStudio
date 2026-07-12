import {
  apiDownload,
  apiFetch,
  triggerBrowserDownload,
} from "@/lib/api/backend";
import type { AuditEvent } from "@/lib/types";

export const auditService = {
  list(engagementId: string, limit = 200): Promise<AuditEvent[]> {
    return apiFetch<AuditEvent[]>(
      `/api/v1/audit/${engagementId}?limit=${limit}`,
    );
  },

  async downloadCsv(engagementId: string): Promise<void> {
    const blob = await apiDownload(
      `/api/v1/audit/${engagementId}/export.csv`,
    );
    triggerBrowserDownload(blob, `audit-${engagementId}.csv`);
  },
};
