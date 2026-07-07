"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FUNCTION_UNITS } from "@/lib/constants/function-units";
import { VALUE_STREAM_META, VALUE_STREAM_ORDER } from "@/lib/constants/value-streams";
import { teleologyService } from "@/lib/mock/services/teleology-service";
import { useRole } from "@/lib/context/role-context";
import type {
  FunctionalUnit,
  TeleologyMatrix,
  TeleologyRow,
  ValueStreamType,
} from "@/lib/types";
import { TeleologyMatrixTable } from "@/components/teleology/teleology-matrix-table";
import { TeleologyRowEditor } from "@/components/teleology/teleology-row-editor";
import { FunctionUnitLegend } from "@/components/functions/function-unit-legend";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TeleologyWorkspaceProps {
  engagementId: string;
  loadedStreams: ValueStreamType[];
}

function canStakeholderApproveRow(
  row: TeleologyRow,
  functionUnits: FunctionalUnit[],
): boolean {
  if (!row.functionUnit) {
    return true;
  }
  return functionUnits.includes(row.functionUnit);
}

export function TeleologyWorkspace({
  engagementId,
  loadedStreams,
}: TeleologyWorkspaceProps): React.ReactNode {
  const { canEdit, canApprove, functionUnits } = useRole();
  const [matrix, setMatrix] = useState<TeleologyMatrix | null>(null);
  const [activeStream, setActiveStream] = useState<ValueStreamType>(
    loadedStreams[0] ?? "o2c",
  );
  const [selectedRow, setSelectedRow] = useState<TeleologyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [addFunctionUnit, setAddFunctionUnit] = useState<FunctionalUnit | "">(
    "",
  );

  const loadMatrix = useCallback(async (): Promise<void> => {
    setLoading(true);
    const data = await teleologyService.getMatrix(engagementId);
    setMatrix(data);
    setSelectedRow((current) => {
      if (!current) {
        const streamRows = data.rows.filter(
          (row) => row.streamType === activeStream,
        );
        return streamRows[0] ?? data.rows[0] ?? null;
      }
      return data.rows.find((row) => row.id === current.id) ?? data.rows[0] ?? null;
    });
    setLoading(false);
  }, [engagementId, activeStream]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    if (!loadedStreams.includes(activeStream) && loadedStreams[0]) {
      setActiveStream(loadedStreams[0]);
    }
  }, [activeStream, loadedStreams]);

  const streamRows = useMemo(() => {
    if (!matrix) {
      return [];
    }
    return matrix.rows.filter((row) => row.streamType === activeStream);
  }, [matrix, activeStream]);

  const existingFunctionUnits = useMemo(
    () =>
      new Set(
        streamRows
          .map((row) => row.functionUnit)
          .filter((unit): unit is FunctionalUnit => Boolean(unit)),
      ),
    [streamRows],
  );

  const availableFunctionUnits = FUNCTION_UNITS.filter(
    (unit) => !existingFunctionUnits.has(unit.id),
  );

  const refreshRow = (updated: TeleologyRow | null): void => {
    if (!updated || !matrix) {
      return;
    }
    setMatrix({
      ...matrix,
      rows: matrix.rows.map((row) => (row.id === updated.id ? updated : row)),
    });
    setSelectedRow(updated);
  };

  const handleSave = async (
    draft: Pick<TeleologyRow, "goals" | "gaps" | "ambitions" | "orgAmbitions">,
  ): Promise<void> => {
    if (!selectedRow || !canEdit) {
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    const updated = await teleologyService.updateRow(
      engagementId,
      selectedRow.id,
      draft,
    );
    refreshRow(updated);
    setStatusMessage("Teleology row saved.");
    setSaving(false);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!selectedRow || !canEdit) {
      return;
    }
    setSaving(true);
    const updated = await teleologyService.submitForReview(
      engagementId,
      selectedRow.id,
    );
    refreshRow(updated);
    setStatusMessage("Submitted for stakeholder review.");
    setSaving(false);
  };

  const handleApprove = async (): Promise<void> => {
    if (!selectedRow || !canApprove) {
      return;
    }
    setSaving(true);
    const updated = await teleologyService.approveRow(
      engagementId,
      selectedRow.id,
    );
    refreshRow(updated);
    setStatusMessage("Row approved.");
    setSaving(false);
  };

  const handleReject = async (): Promise<void> => {
    if (!selectedRow || !canApprove) {
      return;
    }
    setSaving(true);
    const updated = await teleologyService.rejectRow(
      engagementId,
      selectedRow.id,
    );
    refreshRow(updated);
    setStatusMessage("Row rejected — consultant can revise.");
    setSaving(false);
  };

  const handleResetToDraft = async (): Promise<void> => {
    if (!selectedRow || !canEdit) {
      return;
    }
    setSaving(true);
    const updated = await teleologyService.setStatus(
      engagementId,
      selectedRow.id,
      "draft",
    );
    refreshRow(updated);
    setStatusMessage("Row reset to draft.");
    setSaving(false);
  };

  const handleAddFunctionRow = async (): Promise<void> => {
    if (!addFunctionUnit || !canEdit) {
      return;
    }
    setSaving(true);
    const created = await teleologyService.addFunctionRow(
      engagementId,
      activeStream,
      addFunctionUnit,
    );
    if (created) {
      await loadMatrix();
      setSelectedRow(created);
      setStatusMessage(`Added ${FUNCTION_UNITS.find((u) => u.id === addFunctionUnit)?.label} drill-down.`);
      setAddFunctionUnit("");
    }
    setSaving(false);
  };

  if (loadedStreams.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-card p-6">
        <p className="font-medium">No baselines loaded yet</p>
        <p className="text-sm text-muted-foreground">
          Load at least one value stream before capturing teleology.
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

  if (loading || !matrix) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading teleology matrix…
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {VALUE_STREAM_ORDER.filter((streamType) =>
            loadedStreams.includes(streamType),
          ).map((streamType) => {
            const meta = VALUE_STREAM_META[streamType];
            const active = streamType === activeStream;
            return (
              <Button
                key={streamType}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => {
                  setActiveStream(streamType);
                  const nextRow = matrix.rows.find(
                    (row) =>
                      row.streamType === streamType && !row.functionUnit,
                  );
                  setSelectedRow(nextRow ?? null);
                }}
              >
                {meta.shortLabel}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {streamRows.length} row{streamRows.length === 1 ? "" : "s"} ·{" "}
          {VALUE_STREAM_META[activeStream].label}
        </p>
      </div>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Teleology matrix
              </p>
              <p className="text-sm text-muted-foreground">
                Stream row plus optional function drill-down per loaded baseline.
              </p>
            </div>
            {canEdit && availableFunctionUnits.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={addFunctionUnit}
                  onValueChange={(value) =>
                    setAddFunctionUnit(value as FunctionalUnit)
                  }
                >
                  <SelectTrigger className="w-[200px]" size="sm">
                    <SelectValue placeholder="Function drill-down" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFunctionUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!addFunctionUnit || saving}
                  onClick={() => void handleAddFunctionRow()}
                >
                  <Plus className="size-4" />
                  Add row
                </Button>
              </div>
            ) : null}
          </div>

          <TeleologyMatrixTable
            rows={streamRows}
            selectedRowId={selectedRow?.id ?? null}
            onSelect={setSelectedRow}
          />

          <FunctionUnitLegend compact />
        </div>

        <TeleologyRowEditor
          row={selectedRow}
          canEdit={canEdit}
          canApprove={canApprove}
          canApproveRow={
            selectedRow
              ? canStakeholderApproveRow(selectedRow, functionUnits)
              : false
          }
          saving={saving}
          onSave={(draft) => void handleSave(draft)}
          onSubmit={() => void handleSubmit()}
          onApprove={() => void handleApprove()}
          onReject={() => void handleReject()}
          onResetToDraft={() => void handleResetToDraft()}
        />
      </div>
    </div>
  );
}
