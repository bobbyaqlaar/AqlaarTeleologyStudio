import { apiFetch } from "@/lib/api/backend";
import { solutionsService } from "@/lib/api/solutions-service";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { updateStreamApprovalStatus } from "@/lib/mock/store";
import { commentService } from "@/lib/mock/services/process-service";
import { engagementService } from "@/lib/mock/services/engagement-service";
import { teleologyService } from "@/lib/mock/services/teleology-service";
import type {
  ApprovalStatus,
  Engagement,
  Initiative,
  ReviewQueue,
  ReviewQueueItem,
  ReviewSummary,
  SolutionOption,
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

async function setStreamApproval(
  engagementId: string,
  streamType: ValueStreamType,
  approvalStatus: ApprovalStatus,
): Promise<Engagement | null> {
  try {
    return await apiFetch<Engagement>(
      `/api/v1/engagements/${engagementId}/streams/${streamType}/approval`,
      { method: "PATCH", body: JSON.stringify({ approvalStatus }) },
    );
  } catch {
    return updateStreamApprovalStatus(engagementId, streamType, approvalStatus) ?? null;
  }
}

async function buildQueue(engagementId: string): Promise<ReviewQueue> {
  const [engagement, teleology, openComments] = await Promise.all([
    engagementService.get(engagementId),
    teleologyService.getMatrix(engagementId),
    commentService.listOpen(engagementId),
  ]);

  // API-only extras — absent in UI-only (mock) mode.
  let acceptedOptions: SolutionOption[] = [];
  let acceptedInitiatives: Initiative[] = [];
  try {
    const [allOptions, allInitiatives] = await Promise.all([
      solutionsService.listOptions(engagementId),
      solutionsService.listInitiatives(engagementId),
    ]);
    acceptedOptions = allOptions.filter((o) => o.status === "accepted");
    acceptedInitiatives = allInitiatives.filter(
      (i) => i.status === "accepted",
    );
  } catch {
    // backend offline — queue works without agent artefacts
  }

  const items: ReviewQueueItem[] = [];

  if (engagement) {
    for (const stream of engagement.valueStreams) {
      if (!stream.baselineLoaded || stream.approvalStatus === "draft") {
        continue;
      }
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

  for (const comment of openComments) {
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

  for (const option of acceptedOptions) {
    items.push({
      id: `option:${option.id}`,
      engagementId,
      artefactType: "solution_option",
      streamType: option.streamType,
      functionUnit: option.functionUnit ?? undefined,
      title: option.title,
      subtitle: `Accepted ${option.optionType.replace("_", " ")} · effort ${option.effort} · impact ${option.impact}`,
      approvalStatus: "approved",
      updatedAt: option.updatedAt,
      href: `/engagements/${engagementId}/alignment`,
    });
  }

  for (const initiative of acceptedInitiatives) {
    const firstStream = initiative.streams[0];
    if (!firstStream) {
      continue;
    }
    items.push({
      id: `initiative:${initiative.id}`,
      engagementId,
      artefactType: "initiative",
      streamType: firstStream,
      title: initiative.name,
      subtitle: `Accepted initiative spanning ${initiative.streams
        .map((s) => VALUE_STREAM_META[s]?.shortLabel ?? s)
        .join(" + ")}`,
      approvalStatus: "approved",
      updatedAt: initiative.updatedAt,
      href: `/engagements/${engagementId}/initiatives`,
    });
  }

  const sorted = items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return { engagementId, items: sorted, summary: buildSummary(sorted) };
}

async function setItemStatus(
  engagementId: string,
  itemId: string,
  approvalStatus: ApprovalStatus,
): Promise<ReviewQueue | null> {
  if (itemId.startsWith("stream:")) {
    const streamType = itemId.replace("stream:", "") as ValueStreamType;
    await setStreamApproval(engagementId, streamType, approvalStatus);
    return buildQueue(engagementId);
  }
  if (itemId.startsWith("teleology:")) {
    const rowId = itemId.replace("teleology:", "");
    await teleologyService.setStatus(engagementId, rowId, approvalStatus);
    return buildQueue(engagementId);
  }
  return null;
}

/** Composes the review queue from the Postgres-backed services (streams,
 * teleology, comments); presentation labels stay client-side. */
export const reviewService = {
  getQueue(engagementId: string): Promise<ReviewQueue> {
    return buildQueue(engagementId);
  },

  approve(engagementId: string, itemId: string): Promise<ReviewQueue | null> {
    return setItemStatus(engagementId, itemId, "approved");
  },

  reject(engagementId: string, itemId: string): Promise<ReviewQueue | null> {
    return setItemStatus(engagementId, itemId, "rejected");
  },

  async submitStream(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<ReviewQueue | null> {
    await setStreamApproval(engagementId, streamType, "in_review");
    return buildQueue(engagementId);
  },

  async resetStream(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<ReviewQueue | null> {
    await setStreamApproval(engagementId, streamType, "draft");
    return buildQueue(engagementId);
  },

  async resolveFeedback(
    engagementId: string,
    commentId: string,
  ): Promise<ReviewQueue | null> {
    const resolved = await commentService.resolve(commentId);
    if (!resolved) {
      return null;
    }
    return buildQueue(engagementId);
  },
};
