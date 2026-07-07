"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { reviewService } from "@/lib/mock/services/review-service";
import { engagementService } from "@/lib/mock/services/engagement-service";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { useRole } from "@/lib/context/role-context";
import type { Engagement, ReviewQueue, ReviewQueueItem } from "@/lib/types";
import { ReviewSummaryCards } from "@/components/review/review-summary-cards";
import { ReviewQueueTable } from "@/components/review/review-queue-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReviewWorkspaceProps {
  engagementId: string;
}

type ReviewFilter = "all" | "in_review" | "feedback" | "rejected";

export function ReviewWorkspace({
  engagementId,
}: ReviewWorkspaceProps): React.ReactNode {
  const { canEdit, canApprove, functionUnits } = useRole();
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [queueData, engagementData] = await Promise.all([
      reviewService.getQueue(engagementId),
      engagementService.get(engagementId),
    ]);
    setQueue(queueData);
    setEngagement(engagementData);
    setSelectedItem((current) => {
      if (!current) {
        return queueData.items[0] ?? null;
      }
      return queueData.items.find((item) => item.id === current.id) ?? queueData.items[0] ?? null;
    });
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    if (!queue) {
      return [];
    }
    switch (filter) {
      case "in_review":
        return queue.items.filter((item) => item.approvalStatus === "in_review");
      case "feedback":
        return queue.items.filter((item) => item.approvalStatus === "open");
      case "rejected":
        return queue.items.filter((item) => item.approvalStatus === "rejected");
      default:
        return queue.items;
    }
  }, [queue, filter]);

  const draftStreams = useMemo(
    () =>
      engagement?.valueStreams.filter(
        (stream) => stream.baselineLoaded && stream.approvalStatus === "draft",
      ) ?? [],
    [engagement],
  );

  const refreshQueue = (updated: ReviewQueue | null): void => {
    if (!updated) {
      return;
    }
    setQueue(updated);
    setSelectedItem((current) =>
      current
        ? updated.items.find((item) => item.id === current.id) ?? updated.items[0] ?? null
        : updated.items[0] ?? null,
    );
  };

  const handleApprove = async (item: ReviewQueueItem): Promise<void> => {
    setBusyId(item.id);
    setStatusMessage(null);
    refreshQueue(await reviewService.approve(engagementId, item.id));
    setStatusMessage(`${item.title} approved.`);
    setBusyId(null);
  };

  const handleReject = async (item: ReviewQueueItem): Promise<void> => {
    setBusyId(item.id);
    setStatusMessage(null);
    refreshQueue(await reviewService.reject(engagementId, item.id));
    setStatusMessage(`${item.title} rejected — consultant can revise.`);
    setBusyId(null);
  };

  const handleResolve = async (item: ReviewQueueItem): Promise<void> => {
    const commentId = item.id.replace("feedback:", "");
    setBusyId(item.id);
    setStatusMessage(null);
    refreshQueue(await reviewService.resolveFeedback(engagementId, commentId));
    setStatusMessage("Feedback marked resolved.");
    setBusyId(null);
  };

  const handleSubmitStream = async (
    streamType: ReviewQueueItem["streamType"],
  ): Promise<void> => {
    setBusyId(`submit:${streamType}`);
    setStatusMessage(null);
    refreshQueue(await reviewService.submitStream(engagementId, streamType));
    const refreshedEngagement = await engagementService.get(engagementId);
    setEngagement(refreshedEngagement);
    setStatusMessage(
      `${VALUE_STREAM_META[streamType].shortLabel} submitted for review.`,
    );
    setBusyId(null);
  };

  const handleResubmit = async (item: ReviewQueueItem): Promise<void> => {
    if (item.artefactType === "value_stream") {
      await handleSubmitStream(item.streamType);
      return;
    }
    setStatusMessage("Revise teleology in Teleology step, then submit for review again.");
  };

  if (loading || !queue) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading review queue…
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Stakeholders approve artefacts within their function scope. Consultants
        resolve BPMN feedback and resubmit until sign-off.
      </p>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      <ReviewSummaryCards summary={queue.summary} />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["in_review", "In review"],
            ["feedback", "Feedback"],
            ["rejected", "Rejected"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ReviewQueueTable
          items={filteredItems}
          selectedId={selectedItem?.id ?? null}
          canEdit={canEdit}
          canApprove={canApprove}
          functionUnits={functionUnits}
          busyId={busyId}
          onSelect={setSelectedItem}
          onApprove={(item) => void handleApprove(item)}
          onReject={(item) => void handleReject(item)}
          onResolve={(item) => void handleResolve(item)}
        />

        <div className="rounded-lg border border-border bg-card p-4">
          {selectedItem ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Selected item
                </p>
                <h3 className="mt-1 text-lg font-semibold">{selectedItem.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedItem.subtitle}
                </p>
              </div>

              {selectedItem.commentBody ? (
                <blockquote className="rounded-md border border-border bg-muted/20 p-3 text-sm italic">
                  {selectedItem.commentBody}
                </blockquote>
              ) : null}

              <Link
                href={selectedItem.href}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Open artefact
              </Link>

              {canEdit && selectedItem.approvalStatus === "rejected" ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void handleResubmit(selectedItem)}
                >
                  <Send className="size-3.5" />
                  Resubmit for review
                </Button>
              ) : null}

              {canApprove &&
              selectedItem.approvalStatus === "in_review" &&
              selectedItem.functionUnit &&
              !functionUnits.includes(selectedItem.functionUnit) ? (
                <p className="text-xs text-muted-foreground">
                  Switch stakeholder scope to{" "}
                  {selectedItem.functionUnit.replace("_", " ")} to approve this item.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a queue item to inspect details.
            </p>
          )}
        </div>
      </div>

      {canEdit && draftStreams.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ready to submit
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Loaded streams still in draft can be sent to stakeholders for review.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {draftStreams.map((stream) => (
              <Button
                key={stream.id}
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busyId === `submit:${stream.type}`}
                onClick={() => void handleSubmitStream(stream.type)}
              >
                <Send className="size-3.5" />
                Submit {VALUE_STREAM_META[stream.type].shortLabel}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
