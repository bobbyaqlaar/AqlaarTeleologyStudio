"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import type { AiGapSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GapSuggestionsDrawerProps {
  suggestions: AiGapSuggestion[];
  loading: boolean;
  onSelectElement?: (elementId: string) => void;
}

export function GapSuggestionsDrawer({
  suggestions,
  loading,
  onSelectElement,
}: GapSuggestionsDrawerProps): React.ReactNode {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="size-4 text-primary" />
        <p className="text-sm font-medium">AI gap analysis</p>
        {loading ? (
          <span className="text-xs text-muted-foreground">Analyzing…</span>
        ) : null}
      </div>
      <div className="max-h-40 space-y-2 overflow-auto p-3">
        {suggestions.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">
            Edit the process map to receive live gap suggestions.
          </p>
        ) : (
          suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              disabled={!suggestion.elementId || !onSelectElement}
              onClick={() =>
                suggestion.elementId && onSelectElement?.(suggestion.elementId)
              }
              className={cn(
                "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                suggestion.severity === "warning"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border bg-muted/20",
                suggestion.elementId && "hover:bg-muted/40",
              )}
            >
              {suggestion.severity === "warning" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              ) : (
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              )}
              <span>{suggestion.message}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
