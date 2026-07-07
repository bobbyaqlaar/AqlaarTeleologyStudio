import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { listOpenProcessComments, resolveProcessComment } from "@/lib/mock/process-store";
import {
  getEngagementById,
  updateStreamApprovalStatus,
} from "@/lib/mock/store";
import {
  getTeleologyMatrixSnapshot,
  setTeleologyRowStatus,
} from "@/lib/mock/teleology-store";
import type {
  FunctionalUnit,
  ReviewQueue,
  ReviewQueueItem,
  ReviewSummary,
  ValueStreamType,
} from "@/lib/types";

function buildSummary(items: ReviewQueueItem[]): ReviewSummary {
  return items.reduce<ReviewSummary>(
    (acc, item) => {
      if (item.approvalStatus === "open") {
        acc.openFeedback += 1;
      } else if (item.approvalStatus === "in_review") {
        acc.inReview += 1;
      } else if (item.approvalStatus === "approved") {
        acc.approved += 1;
      } else if (item.approvalStatus === "rejected") {
        acc.rejected += 1;
      }
      return acc;
    },
    { inReview: 0, approved: 0, rejected: 0, openFeedback: 0 },
  );
}

export function getReviewQueueSnapshot(engagementId: string): ReviewQueue {
  const engagement = getEngagementById(engagementId);
  const items: ReviewQueueItem[] = [];

  if (engagement) {
    for (const stream of engagement.valueStreams) {
      if (!stream.baselineLoaded) {
        continue;
      }

      if (stream.approvalStatus !== "draft") {
        items.push({
          id: `stream:${stream.type}`,
          engagementId,
          artefactType: "value_stream",
          streamType: stream.type,
          title: VALUE_STREAM_META[stream.type].label,
          subtitle: "Process map, ontology links, and stream bundle",
          approvalStatus: stream.approvalStatus,
          updatedAt: engagement.updatedAt,
          href: `/engagements/${engagementId}/streams/${stream.type}/process`,
        });
      }
    }
  }

  const teleology = getTeleologyMatrixSnapshot(engagementId);
  for (const row of teleology.rows) {
    if (row.approvalStatus === "draft") {
      continue;
    }

    const streamMeta = VALUE_STREAM_META[row.streamType];
    const functionMeta = row.functionUnit
      ? FUNCTION_UNIT_MAP[row.functionUnit]
      : null;

    items.push({
      id: `teleology:${row.id}`,
      engagementId,
      artefactType: "teleology_row",
      streamType: row.streamType,
      functionUnit: row.functionUnit,
      title: functionMeta
        ? `${functionMeta.label} teleology`
        : `${streamMeta.shortLabel} stream teleology`,
      subtitle: `${row.goals.length} goals · ${row.gaps.length} gaps · ${row.ambitions.length} ambitions`,
      approvalStatus: row.approvalStatus,
      updatedAt: row.updatedAt,
      teleologyRowId: row.id,
      href: `/engagements/${engagementId}/teleology`,
    });
  }

  for (const comment of listOpenProcessComments(engagementId)) {
    items.push({
      id: `feedback:${comment.id}`,
      engagementId,
      artefactType: "process_feedback",
      streamType: comment.streamType,
      functionUnit: comment.functionUnit,
      title: comment.targetLabel,
      subtitle: `Comment from ${comment.authorName}`,
      approvalStatus: "open",
      updatedAt: comment.createdAt,
      commentBody: comment.body,
      targetId: comment.targetId,
      href: `/engagements/${engagementId}/streams/${comment.streamType}/process`,
    });
  }

  const sorted = items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return {
    engagementId,
    items: structuredClone(sorted),
    summary: buildSummary(sorted),
  };
}

export function approveReviewItem(
  engagementId: string,
  itemId: string,
): ReviewQueue | undefined {
  if (itemId.startsWith("stream:")) {
    const streamType = itemId.replace("stream:", "") as ValueStreamType;
    updateStreamApprovalStatus(engagementId, streamType, "approved");
    return getReviewQueueSnapshot(engagementId);
  }

  if (itemId.startsWith("teleology:")) {
    const rowId = itemId.replace("teleology:", "");
    setTeleologyRowStatus(engagementId, rowId, "approved");
    return getReviewQueueSnapshot(engagementId);
  }

  return undefined;
}

export function rejectReviewItem(
  engagementId: string,
  itemId: string,
): ReviewQueue | undefined {
  if (itemId.startsWith("stream:")) {
    const streamType = itemId.replace("stream:", "") as ValueStreamType;
    updateStreamApprovalStatus(engagementId, streamType, "rejected");
    return getReviewQueueSnapshot(engagementId);
  }

  if (itemId.startsWith("teleology:")) {
    const rowId = itemId.replace("teleology:", "");
    setTeleologyRowStatus(engagementId, rowId, "rejected");
    return getReviewQueueSnapshot(engagementId);
  }

  return undefined;
}

export function submitStreamForReview(
  engagementId: string,
  streamType: ValueStreamType,
): ReviewQueue | undefined {
  updateStreamApprovalStatus(engagementId, streamType, "in_review");
  return getReviewQueueSnapshot(engagementId);
}

export function resetStreamToDraft(
  engagementId: string,
  streamType: ValueStreamType,
): ReviewQueue | undefined {
  updateStreamApprovalStatus(engagementId, streamType, "draft");
  return getReviewQueueSnapshot(engagementId);
}

export function resolveFeedbackItem(
  engagementId: string,
  commentId: string,
): ReviewQueue | undefined {
  const comment = resolveProcessComment(commentId);
  if (!comment || comment.engagementId !== engagementId) {
    return undefined;
  }
  return getReviewQueueSnapshot(engagementId);
}
