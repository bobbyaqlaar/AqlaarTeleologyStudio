"use client";

import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import type { ImportPreviewResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImportPreviewPanelProps {
  preview: ImportPreviewResult | null;
  loading: boolean;
  canEdit: boolean;
  applying: boolean;
  onApply: () => void;
}

const STATUS_META = {
  ready: {
    label: "Ready",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "text-emerald-500",
  },
  conflict: {
    label: "Conflict",
    variant: "destructive" as const,
    icon: AlertCircle,
    className: "text-amber-500",
  },
  unmapped: {
    label: "Unmapped",
    variant: "secondary" as const,
    icon: HelpCircle,
    className: "text-muted-foreground",
  },
};

export function ImportPreviewPanel({
  preview,
  loading,
  canEdit,
  applying,
  onApply,
}: ImportPreviewPanelProps): React.ReactNode {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Running import preview…
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Connect a system, confirm field mappings, then run preview.
      </div>
    );
  }

  if (preview.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Preview failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{preview.error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              No merge performed. Fix connection or field map and retry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Import preview
          </p>
          <p className="text-sm text-muted-foreground">
            {preview.summary.ready} ready · {preview.summary.conflict} conflict ·{" "}
            {preview.summary.unmapped} unmapped
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            disabled={applying || preview.summary.ready === 0}
            onClick={onApply}
          >
            Apply ready items
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Sample value</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item) => {
                const meta = STATUS_META[item.status];
                const Icon = meta.icon;
                return (
                  <tr key={item.id} className="border-b border-border/70">
                    <td className="px-3 py-2 font-mono text-xs">
                      {item.sourceField}
                    </td>
                    <td className="px-3 py-2">{item.sourceValue}</td>
                    <td className="px-3 py-2">
                      <p>{item.targetLabel}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.targetField}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("size-4", meta.className)} />
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                      {item.note ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.note}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
