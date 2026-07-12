"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import type {
  ConceptProposal,
  LinkProposal,
} from "@/lib/api/agent-service";
import { Button } from "@/components/ui/button";

interface AiLinkSuggestionsPanelProps {
  bpmnLinks: LinkProposal[];
  conceptMappings: ConceptProposal[];
  canEdit: boolean;
  drafting: boolean;
  applying: boolean;
  onDraft: () => void;
  onApplyBpmnLink: (proposal: LinkProposal) => void;
  onApplyConceptMapping: (proposal: ConceptProposal) => void;
  onDismissBpmnLink: (proposal: LinkProposal) => void;
  onDismissConceptMapping: (proposal: ConceptProposal) => void;
}

export function AiLinkSuggestionsPanel({
  bpmnLinks,
  conceptMappings,
  canEdit,
  drafting,
  applying,
  onDraft,
  onApplyBpmnLink,
  onApplyConceptMapping,
  onDismissBpmnLink,
  onDismissConceptMapping,
}: AiLinkSuggestionsPanelProps): React.ReactNode {
  const hasSuggestions = bpmnLinks.length > 0 || conceptMappings.length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">AI link suggestions</p>
          <p className="text-xs text-muted-foreground">
            Proposed class↔step links and thesaurus mappings — apply or dismiss
            each one.
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled={drafting || applying}
            onClick={onDraft}
          >
            {drafting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Draft links
          </Button>
        ) : null}
      </div>

      {!hasSuggestions ? (
        <p className="text-xs text-muted-foreground">
          Run the agent to propose links grounded in your graph and thesaurus.
        </p>
      ) : null}

      {bpmnLinks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Class ↔ step ({bpmnLinks.length})
          </p>
          {bpmnLinks.map((proposal) => (
            <div
              key={`${proposal.classUri}-${proposal.taskId}`}
              className="space-y-2 rounded-md border border-violet-500/20 bg-violet-500/5 p-3"
            >
              <p className="text-sm font-medium">
                {proposal.classLabel} ↔ {proposal.taskName}
              </p>
              {proposal.rationale ? (
                <p className="text-xs text-muted-foreground">
                  {proposal.rationale}
                </p>
              ) : null}
              {canEdit ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={applying}
                    onClick={() => onApplyBpmnLink(proposal)}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={applying}
                    onClick={() => onDismissBpmnLink(proposal)}
                  >
                    <X className="size-3.5" />
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {conceptMappings.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concept mappings ({conceptMappings.length})
          </p>
          {conceptMappings.map((proposal) => (
            <div
              key={`${proposal.classUri}-${proposal.conceptUri}`}
              className="space-y-2 rounded-md border border-violet-500/20 bg-violet-500/5 p-3"
            >
              <p className="text-sm font-medium">
                {proposal.classLabel} → {proposal.conceptLabel}
              </p>
              {proposal.rationale ? (
                <p className="text-xs text-muted-foreground">
                  {proposal.rationale}
                </p>
              ) : null}
              {canEdit ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={applying}
                    onClick={() => onApplyConceptMapping(proposal)}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={applying}
                    onClick={() => onDismissConceptMapping(proposal)}
                  >
                    <X className="size-3.5" />
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
