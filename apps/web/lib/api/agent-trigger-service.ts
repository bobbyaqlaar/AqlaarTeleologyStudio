import { agentService } from "@/lib/api/agent-service";
import type {
  ConceptProposal,
  LinkProposal,
} from "@/lib/api/agent-service";
import type { ValueStreamType } from "@/lib/types";

export interface ProcessTagsTriggerResult {
  trigger: "process-tags";
  streamType: ValueStreamType;
  message: string;
  source: string;
}

export interface OntologyLinksTriggerResult {
  trigger: "ontology-links";
  streamType: ValueStreamType;
  message: string;
  source: string;
  bpmnLinks: LinkProposal[];
  conceptMappings: ConceptProposal[];
}

export type AgentTriggerResult =
  | ProcessTagsTriggerResult
  | OntologyLinksTriggerResult;

const DEBOUNCE_MS = 60_000;
const lastRunAt = new Map<string, number>();

function shouldRun(key: string): boolean {
  const now = Date.now();
  const last = lastRunAt.get(key) ?? 0;
  if (now - last < DEBOUNCE_MS) {
    return false;
  }
  lastRunAt.set(key, now);
  return true;
}

/** Event-driven drafting agents (spec §16). Buttons remain for manual re-run. */
export const agentTriggerService = {
  async onBaselineLoaded(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<ProcessTagsTriggerResult | null> {
    const key = `process-tags:${engagementId}:${streamType}`;
    if (!shouldRun(key)) {
      return null;
    }
    try {
      const result = await agentService.draftProcessTags(engagementId, streamType);
      if (result.suggestions.length === 0) {
        return null;
      }
      return {
        trigger: "process-tags",
        streamType,
        message: `Auto-drafted tags for ${result.suggestions.length} step(s) (${result.source}). Open the process map to review.`,
        source: result.source,
      };
    } catch {
      return null;
    }
  },

  async onOntologyGraphReady(
    engagementId: string,
    streamType: ValueStreamType,
    classCount: number,
  ): Promise<OntologyLinksTriggerResult | null> {
    if (classCount === 0) {
      return null;
    }
    const key = `ontology-links:${engagementId}:${streamType}`;
    if (!shouldRun(key)) {
      return null;
    }
    try {
      const result = await agentService.draftOntologyLinks(
        engagementId,
        streamType,
      );
      const total =
        result.bpmnLinks.length + result.conceptMappings.length;
      if (total === 0) {
        return null;
      }
      return {
        trigger: "ontology-links",
        streamType,
        message: `Auto-drafted ${result.bpmnLinks.length} link(s) and ${result.conceptMappings.length} concept mapping(s) (${result.source}). Review below.`,
        source: result.source,
        bpmnLinks: result.bpmnLinks,
        conceptMappings: result.conceptMappings,
      };
    } catch {
      return null;
    }
  },
};
