import {
  addFunctionTeleologyRow,
  getTeleologyMatrixSnapshot,
  getTeleologyRowById,
  setTeleologyRowStatus,
  updateTeleologyRow,
} from "@/lib/mock/teleology-store";
import type {
  ApprovalStatus,
  FunctionalUnit,
  TeleologyMatrix,
  TeleologyRow,
  UpdateTeleologyRowInput,
  ValueStreamType,
} from "@/lib/types";

export const teleologyService = {
  getMatrix(engagementId: string): Promise<TeleologyMatrix> {
    return Promise.resolve(getTeleologyMatrixSnapshot(engagementId));
  },

  getRow(engagementId: string, rowId: string): Promise<TeleologyRow | null> {
    return Promise.resolve(getTeleologyRowById(engagementId, rowId) ?? null);
  },

  updateRow(
    engagementId: string,
    rowId: string,
    input: UpdateTeleologyRowInput,
  ): Promise<TeleologyRow | null> {
    return Promise.resolve(
      updateTeleologyRow(engagementId, rowId, input) ?? null,
    );
  },

  addFunctionRow(
    engagementId: string,
    streamType: ValueStreamType,
    functionUnit: FunctionalUnit,
  ): Promise<TeleologyRow | null> {
    return Promise.resolve(
      addFunctionTeleologyRow(engagementId, streamType, functionUnit) ?? null,
    );
  },

  submitForReview(
    engagementId: string,
    rowId: string,
  ): Promise<TeleologyRow | null> {
    return Promise.resolve(
      setTeleologyRowStatus(engagementId, rowId, "in_review") ?? null,
    );
  },

  approveRow(
    engagementId: string,
    rowId: string,
  ): Promise<TeleologyRow | null> {
    return Promise.resolve(
      setTeleologyRowStatus(engagementId, rowId, "approved") ?? null,
    );
  },

  rejectRow(
    engagementId: string,
    rowId: string,
  ): Promise<TeleologyRow | null> {
    return Promise.resolve(
      setTeleologyRowStatus(engagementId, rowId, "rejected") ?? null,
    );
  },

  setStatus(
    engagementId: string,
    rowId: string,
    status: ApprovalStatus,
  ): Promise<TeleologyRow | null> {
    return Promise.resolve(
      setTeleologyRowStatus(engagementId, rowId, status) ?? null,
    );
  },
};
