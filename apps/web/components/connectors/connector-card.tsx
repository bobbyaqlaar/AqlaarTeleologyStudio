"use client";

import { Cloud, Link2, Unplug } from "lucide-react";
import { CONNECTOR_FIXTURE_MAP } from "@/lib/mock/fixtures/connector-fixtures";
import type { ConnectorConnection, ConnectorType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ConnectorCardProps {
  connection: ConnectorConnection;
  active: boolean;
  canEdit: boolean;
  busy: boolean;
  instanceUrl: string;
  onSelect: (connectorType: ConnectorType) => void;
  onInstanceUrlChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ConnectorCard({
  connection,
  active,
  canEdit,
  busy,
  instanceUrl,
  onSelect,
  onInstanceUrlChange,
  onConnect,
  onDisconnect,
}: ConnectorCardProps): React.ReactNode {
  const fixture = CONNECTOR_FIXTURE_MAP[connection.connectorType];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(connection.connectorType)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(connection.connectorType);
        }
      }}
      className={cn(
        "w-full cursor-pointer rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/20",
        active && "border-primary ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Cloud className="size-5" />
          </div>
          <div>
            <p className="font-semibold">{fixture.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fixture.description}
            </p>
          </div>
        </div>
        <Badge variant={connection.connected ? "default" : "secondary"}>
          {connection.connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      <div className="mt-4 space-y-3" onClick={(event) => event.stopPropagation()}>
        <div className="space-y-1.5">
          <Label htmlFor={`${connection.connectorType}-url`}>Instance URL</Label>
          <Input
            id={`${connection.connectorType}-url`}
            value={instanceUrl}
            onChange={(event) => onInstanceUrlChange(event.target.value)}
            disabled={!canEdit || connection.connected}
            className="font-mono text-xs"
          />
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {!connection.connected ? (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={onConnect}
              >
                <Link2 className="size-3.5" />
                Connect
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy}
                onClick={onDisconnect}
              >
                <Unplug className="size-3.5" />
                Disconnect
              </Button>
            )}
          </div>
        ) : null}

        <dl className="grid gap-1 text-[11px] text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Last sync</dt>
            <dd>{formatTimestamp(connection.lastSyncAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Last preview</dt>
            <dd>{formatTimestamp(connection.lastPreviewAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Last apply</dt>
            <dd>{formatTimestamp(connection.lastAppliedAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
