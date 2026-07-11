"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { agentService } from "@/lib/api/agent-service";
import { alignmentService } from "@/lib/api/alignment-service";
import { solutionsService } from "@/lib/api/solutions-service";
import { VALUE_STREAM_META, VALUE_STREAM_ORDER } from "@/lib/constants/value-streams";
import { useRole } from "@/lib/context/role-context";
import type {
  AlignmentReport,
  AlignmentUnit,
  SolutionOption,
  ValueStreamType,
} from "@/lib/types";
import { AlignmentDetailPanel } from "@/components/alignment/alignment-detail-panel";
import { AlignmentHeatmap } from "@/components/alignment/alignment-heatmap";
import { SolutionOptionCard } from "@/components/alignment/solution-option-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AlignmentWorkspaceProps {
  engagementId: string;
}

export function AlignmentWorkspace({
  engagementId,
}: AlignmentWorkspaceProps): React.ReactNode {
  const { canEdit } = useRole();
  const [report, setReport] = useState<AlignmentReport | null>(null);
  const [options, setOptions] = useState<SolutionOption[]>([]);
  const [activeStream, setActiveStream] = useState<ValueStreamType | null>(
    null,
  );
  const [selectedUnit, setSelectedUnit] = useState<AlignmentUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [busyOptionId, setBusyOptionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadAll = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [reportData, optionsData] = await Promise.all([
        alignmentService.getReport(engagementId),
        solutionsService.listOptions(engagementId),
      ]);
      setReport(reportData);
      setOptions(optionsData);
      setOffline(false);
      setActiveStream((current) => {
        if (
          current &&
          reportData.streams.some((s) => s.streamType === current)
        ) {
          return current;
        }
        return reportData.streams[0]?.streamType ?? null;
      });
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const stream = useMemo(
    () =>
      report?.streams.find((s) => s.streamType === activeStream) ?? null,
    [report, activeStream],
  );

  useEffect(() => {
    setSelectedUnit((current) => {
      if (!stream) {
        return null;
      }
      if (current) {
        const match = stream.units.find(
          (u) => u.functionUnit === current.functionUnit,
        );
        if (match) {
          return match;
        }
      }
      return stream.units[0] ?? null;
    });
  }, [stream]);

  const streamOptions = useMemo(
    () => options.filter((option) => option.streamType === activeStream),
    [options, activeStream],
  );

  const handleBridgeGaps = async (): Promise<void> => {
    if (!activeStream || !canEdit) {
      return;
    }
    setBridging(true);
    setStatusMessage(null);
    try {
      const result = await agentService.bridgeGaps(engagementId, activeStream);
      setOptions((current) => [
        ...current.filter(
          (option) =>
            option.streamType !== activeStream || option.status !== "draft",
        ),
        ...result.options,
      ]);
      setStatusMessage(
        `AI drafted ${result.options.length} solution option(s) (${result.source}) — accept or dismiss below.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Gap bridging failed: ${error.message}`
          : "Gap bridging failed.",
      );
    }
    setBridging(false);
  };

  const handleOptionStatus = async (
    option: SolutionOption,
    status: "accepted" | "dismissed",
  ): Promise<void> => {
    setBusyOptionId(option.id);
    try {
      const updated = await solutionsService.setOptionStatus(
        engagementId,
        option.id,
        status,
      );
      setOptions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (status === "accepted") {
        setStatusMessage(
          "Option accepted — added to the draft teleology ambitions where applicable.",
        );
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Status change failed.",
      );
    }
    setBusyOptionId(null);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Computing alignment…
      </div>
    );
  }

  if (offline || !report) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 rounded-xl border border-border bg-card p-6">
        <p className="font-medium">Alignment needs the API</p>
        <p className="text-sm text-muted-foreground">
          The alignment report joins Postgres and Fuseki state. Start the
          backend (docker compose up fuseki api) and reload.
        </p>
        <Button size="sm" variant="outline" onClick={() => void loadAll()}>
          Retry
        </Button>
      </div>
    );
  }

  if (report.streams.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 rounded-xl border border-border bg-card p-6">
        <p className="font-medium">No baselines loaded yet</p>
        <p className="text-sm text-muted-foreground">
          Load at least one value stream to compare current state against the
          teleology.
        </p>
        <Link
          href={`/engagements/${engagementId}/streams`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Go to value streams
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {VALUE_STREAM_ORDER.filter((streamType) =>
            report.streams.some((s) => s.streamType === streamType),
          ).map((streamType) => (
            <Button
              key={streamType}
              size="sm"
              variant={streamType === activeStream ? "default" : "outline"}
              onClick={() => setActiveStream(streamType)}
            >
              {VALUE_STREAM_META[streamType].shortLabel}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => void loadAll()}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {canEdit ? (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={bridging || !activeStream}
              onClick={() => void handleBridgeGaps()}
            >
              {bridging ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Bridge gaps with AI
            </Button>
          ) : null}
        </div>
      </div>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      {stream ? (
        <div className="space-y-4">
          <AlignmentHeatmap
            stream={stream}
            selectedUnit={selectedUnit}
            onSelect={setSelectedUnit}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_480px]">
            <AlignmentDetailPanel
              streamType={stream.streamType}
              unit={selectedUnit}
            />

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Solution options ·{" "}
                  {VALUE_STREAM_META[stream.streamType].shortLabel}
                </p>
                <p className="text-sm text-muted-foreground">
                  AI-drafted moves that connect current state to the
                  teleology. Accept to fold into draft artefacts.
                </p>
              </div>
              {streamOptions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No options drafted yet. Run “Bridge gaps with AI”.
                </div>
              ) : (
                streamOptions.map((option) => (
                  <SolutionOptionCard
                    key={option.id}
                    option={option}
                    canEdit={canEdit}
                    busy={busyOptionId === option.id}
                    onAccept={(o) => void handleOptionStatus(o, "accepted")}
                    onDismiss={(o) => void handleOptionStatus(o, "dismissed")}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
