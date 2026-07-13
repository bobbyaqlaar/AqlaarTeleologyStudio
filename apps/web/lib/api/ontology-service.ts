import { authHeaders } from "@/lib/auth/session";
import type {
  FunctionalUnit,
  Industry,
  InitializeGraphResult,
  OntologyGraph,
  OwlClass,
  ThesaurusConcept,
  ThesaurusFramework,
  ValueStreamType,
} from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_OTS_API_URL ?? "http://localhost:8000";

class OntologyApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OntologyApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new OntologyApiError(detail);
  }

  return (await response.json()) as T;
}

export const ontologyService = {
  async health(): Promise<{ status: string; fuseki: boolean }> {
    return request("/health");
  },

  /** Baseline catalog: industry slug → available stream types, plus thesauri. */
  async listBaselines(): Promise<{
    industries: Record<string, ValueStreamType[]>;
    thesauri: string[];
  }> {
    return request("/api/v1/ontology/baselines");
  },

  async initialize(
    engagementId: string,
    streamType: ValueStreamType,
    industry: Industry = "generic",
  ): Promise<InitializeGraphResult> {
    return request(
      `/api/v1/ontology/${engagementId}/${streamType}/initialize?industry=${industry}`,
      { method: "POST" },
    );
  },

  async searchThesaurus(
    framework: ThesaurusFramework,
    query: string,
    limit = 25,
  ): Promise<ThesaurusConcept[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return request(`/api/v1/ontology/thesaurus/${framework}/search?${params}`);
  },

  async mapConcept(
    engagementId: string,
    streamType: ValueStreamType,
    classUri: string,
    conceptUri: string,
  ): Promise<OwlClass> {
    return request(
      `/api/v1/ontology/${engagementId}/${streamType}/concept-mapping`,
      { method: "POST", body: JSON.stringify({ classUri, conceptUri }) },
    );
  },

  async unmapConcept(
    engagementId: string,
    streamType: ValueStreamType,
    classUri: string,
    conceptUri: string,
  ): Promise<OwlClass> {
    return request(
      `/api/v1/ontology/${engagementId}/${streamType}/concept-mapping/remove`,
      { method: "POST", body: JSON.stringify({ classUri, conceptUri }) },
    );
  },

  async getGraph(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<OntologyGraph> {
    return request(`/api/v1/ontology/${engagementId}/${streamType}`);
  },

  async updateClass(
    engagementId: string,
    streamType: ValueStreamType,
    uri: string,
    updates: { label?: string; functionUnit?: FunctionalUnit },
  ): Promise<OwlClass> {
    return request(`/api/v1/ontology/${engagementId}/${streamType}/classes`, {
      method: "PATCH",
      body: JSON.stringify({
        uri,
        label: updates.label,
        functionUnit: updates.functionUnit,
      }),
    });
  },

  async linkBpmnElement(
    engagementId: string,
    streamType: ValueStreamType,
    classUri: string,
    bpmnElementId: string,
  ): Promise<OwlClass> {
    return request(`/api/v1/ontology/${engagementId}/${streamType}/links`, {
      method: "POST",
      body: JSON.stringify({ classUri, bpmnElementId }),
    });
  },

  async linkGoal(
    engagementId: string,
    streamType: ValueStreamType,
    classUri: string,
    teleologyRowId: string,
  ): Promise<OwlClass> {
    return request(
      `/api/v1/ontology/${engagementId}/${streamType}/goal-links`,
      {
        method: "POST",
        body: JSON.stringify({ classUri, teleologyRowId }),
      },
    );
  },

  async unlinkGoal(
    engagementId: string,
    streamType: ValueStreamType,
    classUri: string,
    teleologyRowId: string,
  ): Promise<OwlClass> {
    return request(
      `/api/v1/ontology/${engagementId}/${streamType}/goal-links/remove`,
      {
        method: "POST",
        body: JSON.stringify({ classUri, teleologyRowId }),
      },
    );
  },

  async unlinkBpmnElement(
    engagementId: string,
    streamType: ValueStreamType,
    classUri: string,
    bpmnElementId: string,
  ): Promise<OwlClass> {
    return request(
      `/api/v1/ontology/${engagementId}/${streamType}/links/unlink`,
      {
        method: "POST",
        body: JSON.stringify({ classUri, bpmnElementId }),
      },
    );
  },
};

export { OntologyApiError };
