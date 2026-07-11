"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { agentService } from "@/lib/api/agent-service";
import { solutionsService } from "@/lib/api/solutions-service";
import { useRole } from "@/lib/context/role-context";
import type { Initiative } from "@/lib/types";
import { InitiativeCard } from "@/components/initiatives/initiative-card";
import { InitiativeLinkage } from "@/components/initiatives/initiative-linkage";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InitiativesWorkspaceProps {
  engagementId: string;
}

export function InitiativesWorkspace({
  engagementId,
}: InitiativesWorkspaceProps): React.ReactNode {
  const { canEdit } = useRole();
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [selected, setSelected] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await solutionsService.listInitiatives(engagementId);
      setInitiatives(data);
      setSelected((current) =>
        current
          ? (data.find((item) => item.id === current.id) ?? data[0] ?? null)
          : (data[0] ?? null),
      );
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDraft = async (): Promise<void> => {
    if (!canEdit) {
      return;
    }
    setDrafting(true);
    setStatusMessage(null);
    try {
      const result = await agentService.draftInitiatives(engagementId);
      await load();
      setStatusMessage(
        `AI drafted ${result.initiatives.length} initiative candidate(s) (${result.source}) — each spans multiple value streams.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Drafting failed: ${error.message}`
          : "Drafting failed.",
      );
    }
    setDrafting(false);
  };

  const handleStatus = async (
    initiative: Initiative,
    status: "accepted" | "dismissed",
  ): Promise<void> => {
    setBusyId(initiative.id);
    try {
      const updated = await solutionsService.setInitiativeStatus(
        engagementId,
        initiative.id,
        status,
      );
      setInitiatives((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelected((current) =>
        current?.id === updated.id ? updated : current,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Status change failed.",
      );
    }
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading initiatives…
      </div>
    );
  }

  if (offline) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 rounded-xl border border-border bg-card p-6">
        <p className="font-medium">Initiatives need the API</p>
        <p className="text-sm text-muted-foreground">
          Start the backend (docker compose up fuseki api) and reload.
        </p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Transformation initiative candidates
          </p>
          <p className="text-sm text-muted-foreground">
            Cross-stream moves that connect gaps across value streams — the
            bigger picture beyond stream-scoped solution options.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/engagements/${engagementId}/alignment`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Back to alignment
          </Link>
          {canEdit ? (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={drafting}
              onClick={() => void handleDraft()}
            >
              {drafting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Draft initiatives with AI
            </Button>
          ) : null}
        </div>
      </div>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      {initiatives.length === 0 ? (
        <div className="mx-auto max-w-2xl space-y-3 rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="font-medium">No initiative candidates yet</p>
          <p className="text-sm text-muted-foreground">
            Needs at least two loaded value streams. Run the AI draft to
            surface transformation initiatives that span streams (e.g. one
            platform serving O2C, P2P, and C2M).
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-3">
            {initiatives.map((initiative) => (
              <InitiativeCard
                key={initiative.id}
                initiative={initiative}
                selected={selected?.id === initiative.id}
                canEdit={canEdit}
                busy={busyId === initiative.id}
                onSelect={setSelected}
                onAccept={(item) => void handleStatus(item, "accepted")}
                onDismiss={(item) => void handleStatus(item, "dismissed")}
              />
            ))}
          </div>
          <InitiativeLinkage initiative={selected} />
        </div>
      )}
    </div>
  );
}
