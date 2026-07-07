import type {
  FunctionalUnit,
  InitializeGraphResult,
  OntologyGraph,
  OwlClass,
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

  async initialize(
    engagementId: string,
    streamType: ValueStreamType,
  ): Promise<InitializeGraphResult> {
    return request(
      `/api/v1/ontology/${engagementId}/${streamType}/initialize`,
      { method: "POST" },
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
