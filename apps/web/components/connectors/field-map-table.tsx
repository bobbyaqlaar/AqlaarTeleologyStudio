"use client";

import type { FieldMapping } from "@/lib/types";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface FieldMapTableProps {
  mappings: FieldMapping[];
  canEdit: boolean;
  savingId: string | null;
  onUpdate: (
    mappingId: string,
    updates: Pick<FieldMapping, "sourceField" | "targetField" | "targetLabel" | "targetType">,
  ) => void;
}

const TARGET_TYPES = [
  { value: "bpmn_task", label: "BPMN task" },
  { value: "owl_class", label: "OWL class" },
  { value: "process_meta", label: "Process meta" },
] as const;

export function FieldMapTable({
  mappings,
  canEdit,
  savingId,
  onUpdate,
}: FieldMapTableProps): React.ReactNode {
  if (mappings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No field mappings for this stream. Pick another value stream or connector.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Source field</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Target label</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Stream</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.id} className="border-b border-border/70">
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Input
                      defaultValue={mapping.sourceField}
                      key={`${mapping.id}-source-${mapping.sourceField}`}
                      disabled={savingId === mapping.id}
                      className="h-8 font-mono text-xs"
                      onBlur={(event) =>
                        onUpdate(mapping.id, {
                          ...mapping,
                          sourceField: event.target.value.trim(),
                        })
                      }
                    />
                  ) : (
                    <span className="font-mono text-xs">{mapping.sourceField}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Input
                      defaultValue={mapping.targetField}
                      key={`${mapping.id}-target-${mapping.targetField}`}
                      disabled={savingId === mapping.id}
                      className="h-8 font-mono text-xs"
                      onBlur={(event) =>
                        onUpdate(mapping.id, {
                          ...mapping,
                          targetField: event.target.value.trim(),
                        })
                      }
                    />
                  ) : (
                    <span className="font-mono text-xs">{mapping.targetField}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Input
                      defaultValue={mapping.targetLabel}
                      key={`${mapping.id}-label-${mapping.targetLabel}`}
                      disabled={savingId === mapping.id}
                      className="h-8 text-xs"
                      onBlur={(event) =>
                        onUpdate(mapping.id, {
                          ...mapping,
                          targetLabel: event.target.value.trim(),
                        })
                      }
                    />
                  ) : (
                    mapping.targetLabel
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Select
                      value={mapping.targetType}
                      onValueChange={(value) =>
                        onUpdate(mapping.id, {
                          ...mapping,
                          targetType: value as FieldMapping["targetType"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[130px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {mapping.targetType}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {VALUE_STREAM_META[mapping.streamType].shortLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
