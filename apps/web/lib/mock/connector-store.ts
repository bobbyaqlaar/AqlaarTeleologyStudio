import {
  CONNECTOR_FIXTURE_MAP,
  CONNECTOR_FIXTURES,
} from "@/lib/mock/fixtures/connector-fixtures";
import type {
  ApplyImportResult,
  ConnectorConnection,
  ConnectorType,
  FieldMapping,
  ImportPreviewItem,
  ImportPreviewResult,
  UpdateFieldMappingInput,
  ValueStreamType,
} from "@/lib/types";

interface ConnectorState {
  connections: ConnectorConnection[];
  mappings: FieldMapping[];
}

const previewValues: Record<
  ConnectorType,
  Record<string, string>
> = {
  salesforce: {
    "Opportunity.StageName": "Closed Won",
    "Account.CreditScore": "742",
    "Order.FulfillmentStatus": "Partially Shipped",
    "Invoice.Status": "Sent",
    "Payment.AmountReceived": "$128,400.00",
    "Product2.Name": "Smart Sensor Hub v2",
  },
  jira: {
    "IssueType.name": "Incident",
    "Priority.name": "High",
    "Status.name": "In Progress",
    "Resolution.name": "Fixed",
    "CustomField.slaBreached": "false",
  },
};

function defaultConnections(engagementId: string): ConnectorConnection[] {
  return CONNECTOR_FIXTURES.map((fixture) => ({
    engagementId,
    connectorType: fixture.connectorType,
    connected: fixture.connectorType === "salesforce" && engagementId === "eng-acme-001",
    instanceUrl: fixture.defaultInstanceUrl,
    lastSyncAt:
      fixture.connectorType === "salesforce" && engagementId === "eng-acme-001"
        ? "2026-06-10T16:00:00.000Z"
        : null,
    lastPreviewAt: null,
    lastAppliedAt: null,
  }));
}

function defaultMappings(engagementId: string): FieldMapping[] {
  return CONNECTOR_FIXTURES.flatMap((fixture) =>
    fixture.defaultMappings.map((mapping, index) => ({
      id: `map-${fixture.connectorType}-${index}-${engagementId.slice(-6)}`,
      engagementId,
      ...mapping,
    })),
  );
}

const states = new Map<string, ConnectorState>();

function ensureState(engagementId: string): ConnectorState {
  const existing = states.get(engagementId);
  if (existing) {
    return existing;
  }

  const created: ConnectorState = {
    connections: defaultConnections(engagementId),
    mappings: defaultMappings(engagementId),
  };
  states.set(engagementId, created);
  return created;
}

export function getConnectorConnectionsSnapshot(
  engagementId: string,
): ConnectorConnection[] {
  return structuredClone(ensureState(engagementId).connections);
}

export function getFieldMappingsSnapshot(
  engagementId: string,
  connectorType?: ConnectorType,
  streamType?: ValueStreamType,
): FieldMapping[] {
  const mappings = ensureState(engagementId).mappings.filter((mapping) => {
    if (connectorType && mapping.connectorType !== connectorType) {
      return false;
    }
    if (streamType && mapping.streamType !== streamType) {
      return false;
    }
    return true;
  });
  return structuredClone(mappings);
}

export function connectConnector(
  engagementId: string,
  connectorType: ConnectorType,
  instanceUrl: string,
): ConnectorConnection | undefined {
  const state = ensureState(engagementId);
  const index = state.connections.findIndex(
    (item) => item.connectorType === connectorType,
  );
  if (index === -1) {
    return undefined;
  }

  state.connections[index] = {
    ...state.connections[index],
    connected: true,
    instanceUrl: instanceUrl.trim() || CONNECTOR_FIXTURE_MAP[connectorType].defaultInstanceUrl,
    lastSyncAt: new Date().toISOString(),
  };

  return structuredClone(state.connections[index]);
}

export function disconnectConnector(
  engagementId: string,
  connectorType: ConnectorType,
): ConnectorConnection | undefined {
  const state = ensureState(engagementId);
  const index = state.connections.findIndex(
    (item) => item.connectorType === connectorType,
  );
  if (index === -1) {
    return undefined;
  }

  state.connections[index] = {
    ...state.connections[index],
    connected: false,
    lastSyncAt: null,
    lastPreviewAt: null,
  };

  return structuredClone(state.connections[index]);
}

export function updateFieldMapping(
  engagementId: string,
  mappingId: string,
  input: UpdateFieldMappingInput,
): FieldMapping | undefined {
  const state = ensureState(engagementId);
  const index = state.mappings.findIndex((item) => item.id === mappingId);
  if (index === -1) {
    return undefined;
  }

  state.mappings[index] = {
    ...state.mappings[index],
    sourceField: input.sourceField ?? state.mappings[index].sourceField,
    targetField: input.targetField ?? state.mappings[index].targetField,
    targetLabel: input.targetLabel ?? state.mappings[index].targetLabel,
    targetType: input.targetType ?? state.mappings[index].targetType,
  };

  return structuredClone(state.mappings[index]);
}

function buildPreviewItem(
  mapping: FieldMapping,
  simulateError: boolean,
): ImportPreviewItem {
  const sourceValue =
    previewValues[mapping.connectorType][mapping.sourceField] ??
    `Sample ${mapping.sourceField.split(".").pop()}`;

  let status: ImportPreviewItem["status"] = "ready";
  let note: string | undefined;

  if (simulateError) {
    status = "unmapped";
    note = "Connector preview failed — source field unavailable.";
  } else if (mapping.targetField.includes("missing")) {
    status = "conflict";
    note = "Target BPMN element not found in baseline.";
  } else if (!previewValues[mapping.connectorType][mapping.sourceField]) {
    status = "unmapped";
    note = "No sample value returned for this field.";
  }

  return {
    id: `preview-${mapping.id}`,
    sourceField: mapping.sourceField,
    sourceValue,
    targetField: mapping.targetField,
    targetLabel: mapping.targetLabel,
    targetType: mapping.targetType,
    streamType: mapping.streamType,
    status,
    note,
  };
}

export function previewImport(
  engagementId: string,
  connectorType: ConnectorType,
  streamType: ValueStreamType,
  simulateError = false,
): ImportPreviewResult {
  const state = ensureState(engagementId);
  const connection = state.connections.find(
    (item) => item.connectorType === connectorType,
  );

  if (!connection?.connected) {
    return {
      connectorType,
      streamType,
      items: [],
      summary: { ready: 0, conflict: 0, unmapped: 0 },
      error: "Connect to the system before running import preview.",
    };
  }

  if (simulateError) {
    return {
      connectorType,
      streamType,
      items: [],
      summary: { ready: 0, conflict: 0, unmapped: 0 },
      error: "Connector preview error — no merge performed. Check credentials and field map.",
    };
  }

  const mappings = state.mappings.filter(
    (mapping) =>
      mapping.connectorType === connectorType && mapping.streamType === streamType,
  );

  const items = mappings.map((mapping) => buildPreviewItem(mapping, false));
  const summary = items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { ready: 0, conflict: 0, unmapped: 0 },
  );

  const connectionIndex = state.connections.findIndex(
    (item) => item.connectorType === connectorType,
  );
  if (connectionIndex !== -1) {
    state.connections[connectionIndex].lastPreviewAt = new Date().toISOString();
  }

  return {
    connectorType,
    streamType,
    items: structuredClone(items),
    summary,
  };
}

export function applyImportPreview(
  engagementId: string,
  connectorType: ConnectorType,
  streamType: ValueStreamType,
  preview: ImportPreviewResult,
): ApplyImportResult {
  if (preview.error) {
    return {
      applied: 0,
      skipped: preview.items.length,
      message: "Import blocked — resolve preview errors first.",
    };
  }

  const readyItems = preview.items.filter((item) => item.status === "ready");
  const skipped = preview.items.length - readyItems.length;

  const state = ensureState(engagementId);
  const connectionIndex = state.connections.findIndex(
    (item) => item.connectorType === connectorType,
  );
  if (connectionIndex !== -1) {
    state.connections[connectionIndex].lastAppliedAt = new Date().toISOString();
  }

  return {
    applied: readyItems.length,
    skipped,
    message: `Applied ${readyItems.length} mock pre-fill values to ${streamType.toUpperCase()} templates. Consultant validation still required in Process and Ontology.`,
  };
}

export function resetConnectorStore(): void {
  states.clear();
}
