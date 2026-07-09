import { apiFetch } from "@/lib/api/backend";
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

async function setStatusApi(
  engagementId: string,
  rowId: string,
  status: ApprovalStatus,
): Promise<TeleologyRow | null> {
  try {
    return await apiFetch<TeleologyRow>(
      `/api/v1/teleology/${engagementId}/rows/${rowId}/status`,
      { method: "POST", body: JSON.stringify({ approvalStatus: status }) },
    );
  } catch {
    return setTeleologyRowStatus(engagementId, rowId, status) ?? null;
  }
}

/** Postgres-backed via FastAPI; mock fallback for UI-only mode. */
export const teleologyService = {
  async getMatrix(engagementId: string): Promise<TeleologyMatrix> {
    try {
      return await apiFetch<TeleologyMatrix>(`/api/v1/teleology/${engagementId}`);
    } catch {
      return getTeleologyMatrixSnapshot(engagementId);
    }
  },

  async getRow(engagementId: string, rowId: string): Promise<TeleologyRow | null> {
    try {
      const matrix = await apiFetch<TeleologyMatrix>(
        `/api/v1/teleology/${engagementId}`,
      );
      return matrix.rows.find((row) => row.id === rowId) ?? null;
    } catch {
      return getTeleologyRowById(engagementId, rowId) ?? null;
    }
  },

  async updateRow(
    engagementId: string,
    rowId: string,
    input: UpdateTeleologyRowInput,
  ): Promise<TeleologyRow | null> {
    try {
      return await apiFetch<TeleologyRow>(
        `/api/v1/teleology/${engagementId}/rows/${rowId}`,
        { method: "PATCH", body: JSON.stringify(input) },
      );
    } catch {
      return updateTeleologyRow(engagementId, rowId, input) ?? null;
    }
  },

  async addFunctionRow(
    engagementId: string,
    streamType: ValueStreamType,
    functionUnit: FunctionalUnit,
  ): Promise<TeleologyRow | null> {
    try {
      return await apiFetch<TeleologyRow>(
        `/api/v1/teleology/${engagementId}/rows`,
        {
          method: "POST",
          body: JSON.stringify({ streamType, functionUnit }),
        },
      );
    } catch {
      return addFunctionTeleologyRow(engagementId, streamType, functionUnit) ?? null;
    }
  },

  submitForReview(
    engagementId: string,
    rowId: string,
  ): Promise<TeleologyRow | null> {
    return setStatusApi(engagementId, rowId, "in_review");
  },

  approveRow(
    engagementId: string,
    rowId: string,
  ): Promise<TeleologyRow | null> {
    return setStatusApi(engagementId, rowId, "approved");
  },

  rejectRow(
    engagementId: string,
    rowId: string,
  ): Promise<TeleologyRow | null> {
    return setStatusApi(engagementId, rowId, "rejected");
  },

  setStatus(
    engagementId: string,
    rowId: string,
    status: ApprovalStatus,
  ): Promise<TeleologyRow | null> {
    return setStatusApi(engagementId, rowId, status);
  },
};
