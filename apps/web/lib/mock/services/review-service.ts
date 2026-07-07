import {
  approveReviewItem,
  getReviewQueueSnapshot,
  rejectReviewItem,
  resolveFeedbackItem,
  resetStreamToDraft,
  submitStreamForReview,
} from "@/lib/mock/review-store";
import type { ReviewQueue, ValueStreamType } from "@/lib/types";

export const reviewService = {
  getQueue(engagementId: string): Promise<ReviewQueue> {
    return Promise.resolve(getReviewQueueSnapshot(engagementId));
  },

  approve(engagementId: string, itemId: string): Promise<ReviewQueue | null> {
    return Promise.resolve(approveReviewItem(engagementId, itemId) ?? null);
  },

  reject(engagementId: string, itemId: string): Promise<ReviewQueue | null> {
    return Promise.resolve(rejectReviewItem(engagementId, itemId) ?? null);
  },

  submitStream(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<ReviewQueue | null> {
    return Promise.resolve(submitStreamForReview(engagementId, streamType) ?? null);
  },

  resetStream(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<ReviewQueue | null> {
    return Promise.resolve(resetStreamToDraft(engagementId, streamType) ?? null);
  },

  resolveFeedback(
    engagementId: string,
    commentId: string,
  ): Promise<ReviewQueue | null> {
    return Promise.resolve(
      resolveFeedbackItem(engagementId, commentId) ?? null,
    );
  },
};
