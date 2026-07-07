"use client";

import { useEffect, useState } from "react";
import { FUNCTION_UNITS } from "@/lib/constants/function-units";
import type { FunctionalUnit, OwlClass } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface OwlClassPanelProps {
  owlClass: OwlClass | null;
  canEdit: boolean;
  saving: boolean;
  onSave: (updates: { label: string; functionUnit?: FunctionalUnit }) => void;
}

export function OwlClassPanel({
  owlClass,
  canEdit,
  saving,
  onSave,
}: OwlClassPanelProps): React.ReactNode {
  const [label, setLabel] = useState("");
  const [functionUnit, setFunctionUnit] = useState<FunctionalUnit | "unset">(
    "unset",
  );

  useEffect(() => {
    if (!owlClass) {
      return;
    }
    setLabel(owlClass.label);
    setFunctionUnit(owlClass.functionUnit ?? "unset");
  }, [owlClass]);

  if (!owlClass) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Select an OWL class to edit properties.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Class properties
        </p>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
          {owlClass.uri}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          disabled={!canEdit}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="functionUnit">Function unit</Label>
        <Select
          value={functionUnit}
          onValueChange={(value) =>
            setFunctionUnit(value as FunctionalUnit | "unset")
          }
          disabled={!canEdit}
        >
          <SelectTrigger id="functionUnit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">Not assigned</SelectItem>
            {FUNCTION_UNITS.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canEdit ? (
        <Button
          size="sm"
          disabled={saving || !label.trim()}
          onClick={() =>
            onSave({
              label: label.trim(),
              functionUnit:
                functionUnit === "unset"
                  ? undefined
                  : (functionUnit as FunctionalUnit),
            })
          }
        >
          Save class
        </Button>
      ) : null}
    </div>
  );
}
