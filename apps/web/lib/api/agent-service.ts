import { apiFetch } from "@/lib/api/backend";
import type {
  FunctionalUnit,
  Initiative,
  SolutionOption,
  ValueStreamType,
} from "@/lib/types";

export interface DraftTeleologyResult {
  engagementId: string;
  streamType: ValueStreamType;
  rows: Array<{
    id: string;
    functionUnit: string | null;
    action: "created" | "updated" | "skipped_not_draft";
  }>;
  source: "claude" | "openrouter";
}

export interface BridgeGapsResult {
  engagementId: string;
  streamType: ValueStreamType;
  options: SolutionOption[];
  source: "claude" | "openrouter";
}

export interface DraftInitiativesResult {
  engagementId: string;
  initiatives: Initiative[];
  source: "claude" | "openrouter";
}

export interface TagSuggestion {
  taskId: string;
  taskName: string;
  functionUnit: FunctionalUnit;
  systems: string[];
  rationale: string;
}

export interface DraftProcessTagsResult {
  engagementId: string;
  streamType: ValueStreamType;
  suggestions: TagSuggestion[];
  source: string;
}

export interface LinkProposal {
  classUri: string;
  classLabel: string;
  taskId: string;
  taskName: string;
  rationale: string;
}

export interface ConceptProposal {
  classUri: string;
  classLabel: string;
  conceptUri: string;
  conceptLabel: string;
  rationale: string;
}

export interface DraftOntologyLinksResult {
  engagementId: string;
  streamType: ValueStreamType;
  bpmnLinks: LinkProposal[];
  conceptMappings: ConceptProposal[];
  source: string;
}

/** Phase 2 drafting agents. API-only — agents have no mock fallback; the
 * caller surfaces failures so the consultant knows nothing was drafted. */
export const agentService = {
  draftTeleology(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<DraftTeleologyResult> {
    return apiFetch<DraftTeleologyResult>(
      `/api/v1/agents/${engagementId}/${streamType}/draft-teleology`,
      { method: "POST" },
    );
  },

  bridgeGaps(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<BridgeGapsResult> {
    return apiFetch<BridgeGapsResult>(
      `/api/v1/agents/${engagementId}/${streamType}/bridge-gaps`,
      { method: "POST" },
    );
  },

  draftInitiatives(engagementId: string): Promise<DraftInitiativesResult> {
    return apiFetch<DraftInitiativesResult>(
      `/api/v1/agents/${engagementId}/draft-initiatives`,
      { method: "POST" },
    );
  },

  draftProcessTags(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<DraftProcessTagsResult> {
    return apiFetch<DraftProcessTagsResult>(
      `/api/v1/agents/${engagementId}/${streamType}/draft-process-tags`,
      { method: "POST" },
    );
  },

  draftOntologyLinks(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<DraftOntologyLinksResult> {
    return apiFetch<DraftOntologyLinksResult>(
      `/api/v1/agents/${engagementId}/${streamType}/draft-ontology-links`,
      { method: "POST" },
    );
  },
};
