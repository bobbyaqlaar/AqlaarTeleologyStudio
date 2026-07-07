"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw, Send, X } from "lucide-react";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { FunctionalUnit, TeleologyRow } from "@/lib/types";
import { OrgThemeSection } from "@/components/teleology/org-theme-section";
import { StringListField } from "@/components/teleology/string-list-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TeleologyRowEditorProps {
  row: TeleologyRow | null;
  canEdit: boolean;
  canApprove: boolean;
  canApproveRow: boolean;
  saving: boolean;
  onSave: (draft: Pick<TeleologyRow, "goals" | "gaps" | "ambitions" | "orgAmbitions">) => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onResetToDraft: () => void;
}

export function TeleologyRowEditor({
  row,
  canEdit,
  canApprove,
  canApproveRow,
  saving,
  onSave,
  onSubmit,
  onApprove,
  onReject,
  onResetToDraft,
}: TeleologyRowEditorProps): React.ReactNode {
  const [goals, setGoals] = useState<string[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [ambitions, setAmbitions] = useState<string[]>([]);
  const [orgAmbitions, setOrgAmbitions] = useState(row?.orgAmbitions ?? {
    revenue: [],
    cost: [],
    cx: [],
    ttm: [],
  });

  useEffect(() => {
    if (!row) {
      return;
    }
    setGoals(row.goals);
    setGaps(row.gaps);
    setAmbitions(row.ambitions);
    setOrgAmbitions(row.orgAmbitions);
  }, [row]);

  if (!row) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Select a matrix row to edit goals, gaps, and ambitions.
      </div>
    );
  }

  const streamMeta = VALUE_STREAM_META[row.streamType];
  const functionMeta = row.functionUnit
    ? FUNCTION_UNIT_MAP[row.functionUnit as FunctionalUnit]
    : null;
  const readOnly = !canEdit || row.approvalStatus === "approved";

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {functionMeta ? "Function drill-down" : "Stream teleology"}
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            {functionMeta ? functionMeta.label : streamMeta.label}
          </h3>
          <p className="text-xs text-muted-foreground">
            {functionMeta
              ? `${streamMeta.shortLabel} · scoped to ${functionMeta.label}`
              : `${streamMeta.shortLabel} · stream-wide goals and gaps`}
          </p>
        </div>
        <Badge className="capitalize">{row.approvalStatus.replace("_", " ")}</Badge>
      </div>

      <StringListField
        id="goals"
        label="Goals"
        description="Desired outcomes for this scope."
        items={goals}
        disabled={readOnly}
        placeholder="Add goal…"
        onChange={setGoals}
      />

      <StringListField
        id="gaps"
        label="Gaps"
        description="Current pain points and blockers."
        items={gaps}
        disabled={readOnly}
        placeholder="Add gap…"
        onChange={setGaps}
      />

      <StringListField
        id="ambitions"
        label="Ambitions"
        description="Target improvements to pursue."
        items={ambitions}
        disabled={readOnly}
        placeholder="Add ambition…"
        onChange={setAmbitions}
      />

      <OrgThemeSection
        orgAmbitions={orgAmbitions}
        disabled={readOnly}
        onChange={setOrgAmbitions}
      />

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {canEdit && row.approvalStatus !== "approved" ? (
          <>
            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                onSave({ goals, gaps, ambitions, orgAmbitions })
              }
            >
              Save row
            </Button>
            {(row.approvalStatus === "draft" ||
              row.approvalStatus === "rejected") && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={saving}
                onClick={onSubmit}
              >
                <Send className="size-3.5" />
                Submit for review
              </Button>
            )}
            {row.approvalStatus === "rejected" ? (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={saving}
                onClick={onResetToDraft}
              >
                <RotateCcw className="size-3.5" />
                Reset to draft
              </Button>
            ) : null}
          </>
        ) : null}

        {canApprove && row.approvalStatus === "in_review" && canApproveRow ? (
          <>
            <Button
              size="sm"
              className={cn("gap-1.5")}
              disabled={saving}
              onClick={onApprove}
            >
              <Check className="size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={saving}
              onClick={onReject}
            >
              <X className="size-3.5" />
              Reject
            </Button>
          </>
        ) : null}

        {canApprove && row.approvalStatus === "in_review" && !canApproveRow ? (
          <p className="text-xs text-muted-foreground">
            Approval requires matching function scope for drill-down rows.
          </p>
        ) : null}
      </div>
    </div>
  );
}
