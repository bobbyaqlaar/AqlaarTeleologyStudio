import { apiFetch, BackendApiError } from "@/lib/api/backend";
import type {
  ApplyImportResult,
  ConnectorConnection,
  ConnectorType,
  FieldMapping,
  ImportPreviewResult,
  UpdateFieldMappingInput,
  ValueStreamType,
} from "@/lib/types";

function simulatedPreviewError(
  connectorType: ConnectorType,
  streamType: ValueStreamType,
): ImportPreviewResult {
  return {
    connectorType,
    streamType,
    items: [],
    summary: { ready: 0, conflict: 0, unmapped: 0 },
    error: "Simulated connector error (demo toggle).",
  };
}

/** Live Salesforce/Jira via FastAPI (Postgres-backed state, real HTTP
 * clients on the server). API-only — no in-memory mock fallback. */
export const connectorService = {
  async listConnections(engagementId: string): Promise<ConnectorConnection[]> {
    return apiFetch<ConnectorConnection[]>(
      `/api/v1/connectors/${engagementId}`,
    );
  },

  async listMappings(
    engagementId: string,
    connectorType?: ConnectorType,
    streamType?: ValueStreamType,
  ): Promise<FieldMapping[]> {
    const params = new URLSearchParams();
    if (connectorType) params.set("connectorType", connectorType);
    if (streamType) params.set("streamType", streamType);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return apiFetch<FieldMapping[]>(
      `/api/v1/connectors/${engagementId}/mappings${suffix}`,
    );
  },

  /** Validates credentials against the live system. Throws BackendApiError
   * with the server's reason (unconfigured / rejected). */
  async connect(
    engagementId: string,
    connectorType: ConnectorType,
    instanceUrl: string,
  ): Promise<ConnectorConnection | null> {
    try {
      return await apiFetch<ConnectorConnection>(
        `/api/v1/connectors/${engagementId}/${connectorType}/connect`,
        { method: "POST", body: JSON.stringify({ instanceUrl }) },
      );
    } catch (error) {
      if (error instanceof BackendApiError) {
        throw error;
      }
      throw error;
    }
  },

  async disconnect(
    engagementId: string,
    connectorType: ConnectorType,
  ): Promise<ConnectorConnection | null> {
    return apiFetch<ConnectorConnection>(
      `/api/v1/connectors/${engagementId}/${connectorType}/disconnect`,
      { method: "POST" },
    );
  },

  async updateMapping(
    engagementId: string,
    mappingId: string,
    input: UpdateFieldMappingInput,
  ): Promise<FieldMapping | null> {
    return apiFetch<FieldMapping>(
      `/api/v1/connectors/${engagementId}/mappings/${mappingId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
  },

  /** Live sample values per mapped source field. `simulateError` is a
   * demo affordance that returns a client-side error payload. */
  async preview(
    engagementId: string,
    connectorType: ConnectorType,
    streamType: ValueStreamType,
    simulateError = false,
  ): Promise<ImportPreviewResult> {
    if (simulateError) {
      return simulatedPreviewError(connectorType, streamType);
    }
    try {
      return await apiFetch<ImportPreviewResult>(
        `/api/v1/connectors/${engagementId}/${connectorType}/preview`,
        { method: "POST", body: JSON.stringify({ streamType }) },
      );
    } catch (error) {
      if (error instanceof BackendApiError) {
        return {
          connectorType,
          streamType,
          items: [],
          summary: { ready: 0, conflict: 0, unmapped: 0 },
          error: error.message,
        };
      }
      throw error;
    }
  },

  async applyPreview(
    engagementId: string,
    connectorType: ConnectorType,
    streamType: ValueStreamType,
    preview: ImportPreviewResult,
  ): Promise<ApplyImportResult> {
    try {
      return await apiFetch<ApplyImportResult>(
        `/api/v1/connectors/${engagementId}/${connectorType}/apply`,
        { method: "POST", body: JSON.stringify({ streamType, preview }) },
      );
    } catch (error) {
      if (error instanceof BackendApiError) {
        return {
          applied: 0,
          skipped: preview.items.length,
          message: `Import failed — ${error.message}`,
        };
      }
      throw error;
    }
  },
};
