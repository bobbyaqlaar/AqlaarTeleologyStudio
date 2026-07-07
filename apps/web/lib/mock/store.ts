import { BASELINE_TEMPLATES } from "@/lib/constants/value-streams";
import { ensureProcessState } from "@/lib/mock/process-store";
import type { Engagement, ValueStreamType } from "@/lib/types";

const seedEngagements: Engagement[] = [
  {
    id: "eng-acme-001",
    name: "Digital transformation — Phase 1",
    client: "Acme Corp",
    status: "active",
    description:
      "Baseline mapping for five value streams with stakeholder workshops.",
    participants: [
      {
        userId: "user-consultant-1",
        displayName: "Alex Morgan",
        role: "consultant",
      },
      {
        userId: "user-stakeholder-1",
        displayName: "Jordan Lee",
        role: "stakeholder",
        functionUnits: ["finance", "operations"],
      },
    ],
    valueStreams: BASELINE_TEMPLATES.map((baseline) => ({
      id: `stream-${baseline.streamType}-acme`,
      type: baseline.streamType,
      baselineId: baseline.id,
      baselineLoaded: baseline.streamType === "o2c",
      approvalStatus: baseline.streamType === "o2c" ? "in_review" : "draft",
    })),
    currentStep: "streams",
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-06-08T14:30:00.000Z",
  },
  {
    id: "eng-globex-002",
    name: "Operating model refresh",
    client: "Globex Industries",
    status: "draft",
    description: "Initial scoping for O2C and P2P customization.",
    participants: [
      {
        userId: "user-consultant-1",
        displayName: "Alex Morgan",
        role: "consultant",
      },
    ],
    valueStreams: [],
    currentStep: "streams",
    createdAt: "2026-06-05T11:00:00.000Z",
    updatedAt: "2026-06-05T11:00:00.000Z",
  },
];

let engagements: Engagement[] = structuredClone(seedEngagements);

function createValueStreams(): Engagement["valueStreams"] {
  return BASELINE_TEMPLATES.map((baseline) => ({
    id: `stream-${baseline.streamType}-${crypto.randomUUID().slice(0, 8)}`,
    type: baseline.streamType,
    baselineId: baseline.id,
    baselineLoaded: false,
    approvalStatus: "draft",
  }));
}

export function getEngagementsSnapshot(): Engagement[] {
  return structuredClone(engagements);
}

export function getEngagementById(id: string): Engagement | undefined {
  const engagement = engagements.find((item) => item.id === id);
  return engagement ? structuredClone(engagement) : undefined;
}

export function addEngagement(
  input: Pick<Engagement, "name" | "client" | "description">,
): Engagement {
  const now = new Date().toISOString();
  const engagement: Engagement = {
    id: `eng-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name,
    client: input.client,
    description: input.description,
    status: "draft",
    participants: [
      {
        userId: "user-consultant-1",
        displayName: "Alex Morgan",
        role: "consultant",
      },
    ],
    valueStreams: createValueStreams(),
    currentStep: "streams",
    createdAt: now,
    updatedAt: now,
  };

  engagements = [engagement, ...engagements];
  return structuredClone(engagement);
}

export function loadBaselineForStream(
  engagementId: string,
  streamType: ValueStreamType,
): Engagement | undefined {
  const index = engagements.findIndex((item) => item.id === engagementId);
  if (index === -1) {
    return undefined;
  }

  const engagement = engagements[index];
  const streamIndex = engagement.valueStreams.findIndex(
    (stream) => stream.type === streamType,
  );

  if (streamIndex === -1) {
    return undefined;
  }

  engagement.valueStreams[streamIndex].baselineLoaded = true;
  engagement.updatedAt = new Date().toISOString();
  engagements[index] = engagement;

  ensureProcessState(engagementId, streamType);

  return structuredClone(engagement);
}

export function updateStreamApprovalStatus(
  engagementId: string,
  streamType: ValueStreamType,
  approvalStatus: Engagement["valueStreams"][number]["approvalStatus"],
): Engagement | undefined {
  const index = engagements.findIndex((item) => item.id === engagementId);
  if (index === -1) {
    return undefined;
  }

  const engagement = engagements[index];
  const streamIndex = engagement.valueStreams.findIndex(
    (stream) => stream.type === streamType,
  );
  if (streamIndex === -1) {
    return undefined;
  }

  engagement.valueStreams[streamIndex].approvalStatus = approvalStatus;
  engagement.updatedAt = new Date().toISOString();
  engagements[index] = engagement;

  return structuredClone(engagement);
}

export function resetEngagementStore(): void {
  engagements = structuredClone(seedEngagements);
}
