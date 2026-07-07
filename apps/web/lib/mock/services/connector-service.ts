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

export const connectorService = {
  listConnections(engagementId: string): Promise<ConnectorConnection[]> {
    return Promise.resolve(getConnectorConnectionsSnapshot(engagementId));
  },

  listMappings(
    engagementId: string,
    connectorType?: ConnectorType,
    streamType?: ValueStreamType,
  ): Promise<FieldMapping[]> {
    return Promise.resolve(
      getFieldMappingsSnapshot(engagementId, connectorType, streamType),
    );
  },

  connect(
    engagementId: string,
    connectorType: ConnectorType,
    instanceUrl: string,
  ): Promise<ConnectorConnection | null> {
    return Promise.resolve(
      connectConnector(engagementId, connectorType, instanceUrl) ?? null,
    );
  },

  disconnect(
    engagementId: string,
    connectorType: ConnectorType,
  ): Promise<ConnectorConnection | null> {
    return Promise.resolve(
      disconnectConnector(engagementId, connectorType) ?? null,
    );
  },

  updateMapping(
    engagementId: string,
    mappingId: string,
    input: UpdateFieldMappingInput,
  ): Promise<FieldMapping | null> {
    return Promise.resolve(
      updateFieldMapping(engagementId, mappingId, input) ?? null,
    );
  },

  preview(
    engagementId: string,
    connectorType: ConnectorType,
    streamType: ValueStreamType,
    simulateError = false,
  ): Promise<ImportPreviewResult> {
    return Promise.resolve(
      previewImport(engagementId, connectorType, streamType, simulateError),
    );
  },

  applyPreview(
    engagementId: string,
    connectorType: ConnectorType,
    streamType: ValueStreamType,
    preview: ImportPreviewResult,
  ): Promise<ApplyImportResult> {
    return Promise.resolve(
      applyImportPreview(engagementId, connectorType, streamType, preview),
    );
  },
};
