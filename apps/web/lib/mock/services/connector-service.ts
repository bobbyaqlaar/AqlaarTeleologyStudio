import { apiFetch, BackendApiError } from "@/lib/api/backend";
import {
  applyImportPreview,
  connectConnector,
  disconnectConnector,
  getConnectorConnectionsSnapshot,
  getFieldMappingsSnapshot,
  previewImport,
  updateFieldMapping,
} from "@/lib/mock/connector-store";
import type {
  ApplyImportResult,
  ConnectorConnection,
  ConnectorType,
  FieldMapping,
  ImportPreviewResult,
  UpdateFieldMappingInput,
  ValueStreamType,
} from "@/lib/types";

/** Live Salesforce/Jira via FastAPI (Postgres-backed state, real HTTP
 * clients on the server). Falls back to the in-memory mock store when the
 * API is unreachable (UI-only dev mode). Server-side errors that carry a
 * real reason (missing credentials, auth rejected) are surfaced, not
 * swallowed into the mock. */
export const connectorService = {
  async listConnections(engagementId: string): Promise<ConnectorConnection[]> {
    try {
      return await apiFetch<ConnectorConnection[]>(
        `/api/v1/connectors/${engagementId}`,
      );
    } catch {
      return getConnectorConnectionsSnapshot(engagementId);
    }
  },

  async listMappings(
    engagementId: string,
    connectorType?: ConnectorType,
    streamType?: ValueStreamType,
  ): Promise<FieldMapping[]> {
    try {
      const params = new URLSearchParams();
      if (connectorType) params.set("connectorType", connectorType);
      if (streamType) params.set("streamType", streamType);
      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      return await apiFetch<FieldMapping[]>(
        `/api/v1/connectors/${engagementId}/mappings${suffix}`,
      );
    } catch {
      return getFieldMappingsSnapshot(engagementId, connectorType, streamType);
    }
  },

  /** Validates credentials against the live system. Throws BackendApiError
   * with the server's reason (unconfigured / rejected) so the UI can show
   * it; only falls back to mock when the API itself is unreachable. */
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
      return connectConnector(engagementId, connectorType, instanceUrl) ?? null;
    }
  },

  async disconnect(
    engagementId: string,
    connectorType: ConnectorType,
  ): Promise<ConnectorConnection | null> {
    try {
      return await apiFetch<ConnectorConnection>(
        `/api/v1/connectors/${engagementId}/${connectorType}/disconnect`,
        { method: "POST" },
      );
    } catch {
      return disconnectConnector(engagementId, connectorType) ?? null;
    }
  },

  async updateMapping(
    engagementId: string,
    mappingId: string,
    input: UpdateFieldMappingInput,
  ): Promise<FieldMapping | null> {
    try {
      return await apiFetch<FieldMapping>(
        `/api/v1/connectors/${engagementId}/mappings/${mappingId}`,
        { method: "PATCH", body: JSON.stringify(input) },
      );
    } catch {
      return updateFieldMapping(engagementId, mappingId, input) ?? null;
    }
  },

  /** Live sample values per mapped source field. `simulateError` is a
   * demo affordance and stays on the mock path. */
  async preview(
    engagementId: string,
    connectorType: ConnectorType,
    streamType: ValueStreamType,
    simulateError = false,
  ): Promise<ImportPreviewResult> {
    if (simulateError) {
      return previewImport(engagementId, connectorType, streamType, true);
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
      return previewImport(engagementId, connectorType, streamType, false);
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
      return applyImportPreview(engagementId, connectorType, streamType, preview);
    }
  },
};
