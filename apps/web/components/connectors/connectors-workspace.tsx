"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { CONNECTOR_FIXTURE_MAP } from "@/lib/mock/fixtures/connector-fixtures";
import { connectorService } from "@/lib/mock/services/connector-service";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { useRole } from "@/lib/context/role-context";
import type {
  ConnectorConnection,
  ConnectorType,
  FieldMapping,
  ImportPreviewResult,
  ValueStreamType,
} from "@/lib/types";
import { ConnectorCard } from "@/components/connectors/connector-card";
import { FieldMapTable } from "@/components/connectors/field-map-table";
import { ImportPreviewPanel } from "@/components/connectors/import-preview-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConnectorsWorkspaceProps {
  engagementId: string;
  loadedStreams: ValueStreamType[];
}

export function ConnectorsWorkspace({
  engagementId,
  loadedStreams,
}: ConnectorsWorkspaceProps): React.ReactNode {
  const { canEdit } = useRole();
  const [connections, setConnections] = useState<ConnectorConnection[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [activeConnector, setActiveConnector] = useState<ConnectorType>("salesforce");
  const [activeStream, setActiveStream] = useState<ValueStreamType>("o2c");
  const [instanceUrls, setInstanceUrls] = useState<Record<ConnectorType, string>>({
    salesforce: CONNECTOR_FIXTURE_MAP.salesforce.defaultInstanceUrl,
    jira: CONNECTOR_FIXTURE_MAP.jira.defaultInstanceUrl,
  });
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [simulateError, setSimulateError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeConnection = useMemo(
    () => connections.find((item) => item.connectorType === activeConnector),
    [connections, activeConnector],
  );

  const supportedStreams = useMemo(() => {
    const fixtureStreams = CONNECTOR_FIXTURE_MAP[activeConnector].supportedStreams;
    return loadedStreams.filter((stream) => fixtureStreams.includes(stream));
  }, [activeConnector, loadedStreams]);

  const filteredMappings = useMemo(
    () =>
      mappings.filter(
        (mapping) =>
          mapping.connectorType === activeConnector &&
          mapping.streamType === activeStream,
      ),
    [mappings, activeConnector, activeStream],
  );

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [connectionData, mappingData] = await Promise.all([
      connectorService.listConnections(engagementId),
      connectorService.listMappings(engagementId),
    ]);
    setConnections(connectionData);
    setMappings(mappingData);
    setInstanceUrls({
      salesforce:
        connectionData.find((item) => item.connectorType === "salesforce")
          ?.instanceUrl ?? CONNECTOR_FIXTURE_MAP.salesforce.defaultInstanceUrl,
      jira:
        connectionData.find((item) => item.connectorType === "jira")?.instanceUrl ??
        CONNECTOR_FIXTURE_MAP.jira.defaultInstanceUrl,
    });
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!supportedStreams.includes(activeStream) && supportedStreams[0]) {
      setActiveStream(supportedStreams[0]);
    }
  }, [activeStream, supportedStreams]);

  useEffect(() => {
    setPreview(null);
  }, [activeConnector, activeStream]);

  const handleConnect = async (connectorType: ConnectorType): Promise<void> => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const updated = await connectorService.connect(
        engagementId,
        connectorType,
        instanceUrls[connectorType],
      );
      if (updated) {
        setConnections((current) =>
          current.map((item) =>
            item.connectorType === connectorType ? updated : item,
          ),
        );
        setStatusMessage(
          `${CONNECTOR_FIXTURE_MAP[connectorType].label} connected.`,
        );
      }
    } catch (error) {
      // Server rejected the connect (credentials missing/invalid) — show why.
      setStatusMessage(
        error instanceof Error
          ? `${CONNECTOR_FIXTURE_MAP[connectorType].label}: ${error.message}`
          : "Connect failed.",
      );
    }
    setBusy(false);
  };

  const handleDisconnect = async (
    connectorType: ConnectorType,
  ): Promise<void> => {
    setBusy(true);
    const updated = await connectorService.disconnect(engagementId, connectorType);
    if (updated) {
      setConnections((current) =>
        current.map((item) =>
          item.connectorType === connectorType ? updated : item,
        ),
      );
      setPreview(null);
      setStatusMessage(`${CONNECTOR_FIXTURE_MAP[connectorType].label} disconnected.`);
    }
    setBusy(false);
  };

  const handleMappingUpdate = async (
    mappingId: string,
    updates: Pick<
      FieldMapping,
      "sourceField" | "targetField" | "targetLabel" | "targetType"
    >,
  ): Promise<void> => {
    if (!canEdit) {
      return;
    }
    setSavingId(mappingId);
    const updated = await connectorService.updateMapping(engagementId, mappingId, {
      sourceField: updates.sourceField,
      targetField: updates.targetField,
      targetLabel: updates.targetLabel,
      targetType: updates.targetType,
    });
    if (updated) {
      setMappings((current) =>
        current.map((item) => (item.id === mappingId ? updated : item)),
      );
    }
    setSavingId(null);
  };

  const handlePreview = async (): Promise<void> => {
    setPreviewLoading(true);
    setStatusMessage(null);
    const result = await connectorService.preview(
      engagementId,
      activeConnector,
      activeStream,
      simulateError,
    );
    setPreview(result);
    if (!result.error) {
      const refreshed = await connectorService.listConnections(engagementId);
      setConnections(refreshed);
    }
    setPreviewLoading(false);
  };

  const handleApply = async (): Promise<void> => {
    if (!preview || preview.error) {
      return;
    }
    setBusy(true);
    const result = await connectorService.applyPreview(
      engagementId,
      activeConnector,
      activeStream,
      preview,
    );
    const refreshed = await connectorService.listConnections(engagementId);
    setConnections(refreshed);
    setStatusMessage(result.message);
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading connectors…
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Preview enterprise imports to pre-fill BPMN and OWL templates. Consultant
        validates all changes in Process and Ontology steps.
      </p>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {connections.map((connection) => (
          <ConnectorCard
            key={connection.connectorType}
            connection={connection}
            active={connection.connectorType === activeConnector}
            canEdit={canEdit}
            busy={busy}
            instanceUrl={instanceUrls[connection.connectorType]}
            onSelect={setActiveConnector}
            onInstanceUrlChange={(value) =>
              setInstanceUrls((current) => ({
                ...current,
                [connection.connectorType]: value,
              }))
            }
            onConnect={() => void handleConnect(connection.connectorType)}
            onDisconnect={() => void handleDisconnect(connection.connectorType)}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="connector-stream">Value stream</Label>
              <Select
                value={activeStream}
                onValueChange={(value) =>
                  setActiveStream(value as ValueStreamType)
                }
              >
                <SelectTrigger id="connector-stream">
                  <SelectValue placeholder="Select stream" />
                </SelectTrigger>
                <SelectContent>
                  {supportedStreams.map((streamType) => (
                    <SelectItem key={streamType} value={streamType}>
                      {VALUE_STREAM_META[streamType].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supportedStreams.length === 0 ? (
                <p className="text-xs text-amber-500">
                  Load a supported baseline for {CONNECTOR_FIXTURE_MAP[activeConnector].label}.
                </p>
              ) : null}
            </div>

            {canEdit ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={simulateError}
                  onChange={(event) => setSimulateError(event.target.checked)}
                  className="rounded border-border"
                />
                Simulate preview error
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={
                !activeConnection?.connected ||
                supportedStreams.length === 0 ||
                previewLoading
              }
              onClick={() => void handlePreview()}
            >
              <Eye className="size-4" />
              Run preview
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => void loadData()}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Field map · {CONNECTOR_FIXTURE_MAP[activeConnector].label}
            </p>
            <FieldMapTable
              mappings={filteredMappings}
              canEdit={canEdit}
              savingId={savingId}
              onUpdate={(mappingId, updates) =>
                void handleMappingUpdate(mappingId, updates)
              }
            />
          </div>

          <ImportPreviewPanel
            preview={preview}
            loading={previewLoading}
            canEdit={canEdit}
            applying={busy}
            onApply={() => void handleApply()}
          />
        </div>
      </div>
    </div>
  );
}
