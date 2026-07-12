"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { auditService } from "@/lib/api/audit-service";
import { BackendApiError } from "@/lib/api/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuditEvent } from "@/lib/types";

interface AuditTrailWorkspaceProps {
  engagementId: string;
}

function formatAction(action: string): string {
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ");
}

function formatDetail(detail: Record<string, unknown>): string {
  const entries = Object.entries(detail).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (entries.length === 0) {
    return "—";
  }
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export function AuditTrailWorkspace({
  engagementId,
}: AuditTrailWorkspaceProps): React.ReactNode {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void auditService
      .list(engagementId)
      .then((data) => {
        setEvents(data);
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof BackendApiError
            ? err.message
            : "Audit trail unavailable.",
        );
      })
      .finally(() => setLoading(false));
  }, [engagementId]);

  const handleExportCsv = async (): Promise<void> => {
    setExporting(true);
    setStatusMessage(null);
    try {
      await auditService.downloadCsv(engagementId);
      setStatusMessage("CSV downloaded.");
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "CSV export failed.",
      );
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading audit trail…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"} (newest first)
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={exporting || events.length === 0}
          onClick={() => void handleExportCsv()}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export CSV
        </Button>
      </div>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No audit events yet. Mutations on this engagement will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Artefact</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-4 py-3 align-top whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium">{event.actorName}</p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {event.actorRole}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-top font-medium">
                    {formatAction(event.action)}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">
                    <p>{event.artefactType}</p>
                    <p className="mt-1 font-mono text-muted-foreground">
                      {event.artefactId}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                    {formatDetail(event.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
