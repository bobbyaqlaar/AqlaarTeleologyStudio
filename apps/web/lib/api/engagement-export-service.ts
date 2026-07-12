import { apiDownload, triggerBrowserDownload } from "@/lib/api/backend";

export const engagementExportService = {
  async downloadPdf(
    engagementId: string,
    watermark = "CONFIDENTIAL - DRAFT",
  ): Promise<void> {
    const params = new URLSearchParams({ watermark });
    const blob = await apiDownload(
      `/api/v1/engagements/${engagementId}/export.pdf?${params}`,
    );
    triggerBrowserDownload(blob, `${engagementId}-export.pdf`);
  },
};
