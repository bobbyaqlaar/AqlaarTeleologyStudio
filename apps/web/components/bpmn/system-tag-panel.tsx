"use client";

import { useMemo } from "react";
import { Server, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SYSTEM_CATALOG, SYSTEM_MAP } from "@/lib/constants/systems";

interface SystemTagPanelProps {
  elementId: string | null;
  elementType: string | null;
  systems: string[];
  canEdit: boolean;
  onChange: (systems: string[]) => void;
}

export function SystemTagPanel({
  elementId,
  elementType,
  systems,
  canEdit,
  onChange,
}: SystemTagPanelProps): React.ReactNode {
  const available = useMemo(
    () => SYSTEM_CATALOG.filter((system) => !systems.includes(system.id)),
    [systems],
  );

  if (!elementId || !elementType?.includes("Task")) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Server className="size-4 text-muted-foreground" />
        <Label>Systems</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Which enterprise systems run this step today?
      </p>

      {systems.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {systems.map((systemId) => {
            const system = SYSTEM_MAP[systemId];
            return (
              <Badge key={systemId} variant="secondary" className="gap-1 pr-1">
                {system?.name ?? systemId}
                {canEdit ? (
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-muted"
                    onClick={() =>
                      onChange(systems.filter((id) => id !== systemId))
                    }
                    aria-label={`Remove ${system?.name ?? systemId}`}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </Badge>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-amber-500">
          No system mapped — capture this in the workshop.
        </p>
      )}

      {canEdit && available.length > 0 ? (
        <Select
          value=""
          onValueChange={(value) => {
            if (value) {
              onChange([...systems, value]);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Add system…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((system) => (
              <SelectItem key={system.id} value={system.id}>
                {system.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  · {system.category}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
