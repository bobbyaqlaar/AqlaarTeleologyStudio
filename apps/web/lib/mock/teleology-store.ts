import { getEngagementById } from "@/lib/mock/store";
import type {
  FunctionalUnit,
  OrgAmbitions,
  TeleologyMatrix,
  TeleologyRow,
  UpdateTeleologyRowInput,
  ValueStreamType,
} from "@/lib/types";

const emptyOrgAmbitions = (): OrgAmbitions => ({
  revenue: [],
  cost: [],
  cx: [],
  ttm: [],
});

function rowKey(
  engagementId: string,
  streamType: ValueStreamType,
  functionUnit?: FunctionalUnit,
): string {
  return functionUnit
    ? `${engagementId}:${streamType}:${functionUnit}`
    : `${engagementId}:${streamType}:stream`;
}

function createStreamRow(
  engagementId: string,
  streamType: ValueStreamType,
  seed?: Partial<Omit<TeleologyRow, "id" | "engagementId" | "streamType">>,
): TeleologyRow {
  const now = new Date().toISOString();
  return {
    id: `tel-${streamType}-stream-${engagementId.slice(-8)}`,
    engagementId,
    streamType,
    goals: seed?.goals ?? [],
    gaps: seed?.gaps ?? [],
    ambitions: seed?.ambitions ?? [],
    orgAmbitions: seed?.orgAmbitions ?? emptyOrgAmbitions(),
    approvalStatus: seed?.approvalStatus ?? "draft",
    updatedAt: seed?.updatedAt ?? now,
  };
}

function createFunctionRow(
  engagementId: string,
  streamType: ValueStreamType,
  functionUnit: FunctionalUnit,
  seed?: Partial<Omit<TeleologyRow, "id" | "engagementId" | "streamType" | "functionUnit">>,
): TeleologyRow {
  const now = new Date().toISOString();
  return {
    id: `tel-${streamType}-${functionUnit}-${engagementId.slice(-8)}`,
    engagementId,
    streamType,
    functionUnit,
    goals: seed?.goals ?? [],
    gaps: seed?.gaps ?? [],
    ambitions: seed?.ambitions ?? [],
    orgAmbitions: seed?.orgAmbitions ?? emptyOrgAmbitions(),
    approvalStatus: seed?.approvalStatus ?? "draft",
    updatedAt: seed?.updatedAt ?? now,
  };
}

const seedRows: TeleologyRow[] = [
  createStreamRow("eng-acme-001", "o2c", {
    goals: [
      "Reduce order-to-cash cycle time",
      "Improve collection rate on standard invoices",
    ],
    gaps: [
      "Manual credit checks delay fulfillment",
      "Invoice disputes lack root-cause tracking",
    ],
    ambitions: [
      "Straight-through processing for standard orders",
      "Automated dunning with CX-safe messaging",
    ],
    orgAmbitions: {
      revenue: ["Increase repeat purchase rate on key accounts"],
      cost: ["Cut days sales outstanding by 15 days"],
      cx: ["Proactive order status notifications"],
      ttm: ["Launch self-service order changes in Q3"],
    },
    approvalStatus: "draft",
    updatedAt: "2026-06-09T10:00:00.000Z",
  }),
  createFunctionRow("eng-acme-001", "o2c", "finance", {
    goals: ["Automate credit decisioning for tier-1 customers"],
    gaps: ["Credit policy rules live in spreadsheets"],
    ambitions: ["Real-time credit exposure dashboard"],
    orgAmbitions: {
      revenue: [],
      cost: ["Reduce manual credit review hours by 40%"],
      cx: [],
      ttm: ["Integrate credit engine with order entry"],
    },
    approvalStatus: "in_review",
    updatedAt: "2026-06-10T14:20:00.000Z",
  }),
  createFunctionRow("eng-acme-001", "o2c", "operations", {
    goals: ["Ship within SLA for 95% of standard orders"],
    gaps: ["Inventory allocation conflicts across channels"],
    ambitions: ["Unified allocation engine across DCs"],
    orgAmbitions: {
      revenue: [],
      cost: ["Lower expedite shipping spend"],
      cx: ["Same-day status on fulfillment exceptions"],
      ttm: [],
    },
    approvalStatus: "draft",
    updatedAt: "2026-06-10T09:15:00.000Z",
  }),
];

let rows: TeleologyRow[] = structuredClone(seedRows);

function ensureRowsForLoadedStreams(engagementId: string): void {
  const engagement = getEngagementById(engagementId);
  if (!engagement) {
    return;
  }

  for (const stream of engagement.valueStreams) {
    if (!stream.baselineLoaded) {
      continue;
    }

    const streamKey = rowKey(engagementId, stream.type);
    if (!rows.some((row) => rowKey(row.engagementId, row.streamType, row.functionUnit) === streamKey)) {
      rows.push(createStreamRow(engagementId, stream.type));
    }
  }
}

export function getTeleologyMatrixSnapshot(
  engagementId: string,
): TeleologyMatrix {
  ensureRowsForLoadedStreams(engagementId);
  const engagement = getEngagementById(engagementId);
  const loadedTypes = new Set(
    engagement?.valueStreams
      .filter((stream) => stream.baselineLoaded)
      .map((stream) => stream.type) ?? [],
  );

  const filtered = rows.filter(
    (row) =>
      row.engagementId === engagementId && loadedTypes.has(row.streamType),
  );

  return {
    engagementId,
    rows: structuredClone(filtered).sort((a, b) => {
      if (a.streamType !== b.streamType) {
        return a.streamType.localeCompare(b.streamType);
      }
      if (!a.functionUnit && b.functionUnit) {
        return -1;
      }
      if (a.functionUnit && !b.functionUnit) {
        return 1;
      }
      return (a.functionUnit ?? "").localeCompare(b.functionUnit ?? "");
    }),
  };
}

export function getTeleologyRowById(
  engagementId: string,
  rowId: string,
): TeleologyRow | undefined {
  ensureRowsForLoadedStreams(engagementId);
  const row = rows.find(
    (item) => item.engagementId === engagementId && item.id === rowId,
  );
  return row ? structuredClone(row) : undefined;
}

export function updateTeleologyRow(
  engagementId: string,
  rowId: string,
  input: UpdateTeleologyRowInput,
): TeleologyRow | undefined {
  const index = rows.findIndex(
    (item) => item.engagementId === engagementId && item.id === rowId,
  );
  if (index === -1) {
    return undefined;
  }

  const current = rows[index];
  rows[index] = {
    ...current,
    goals: input.goals ?? current.goals,
    gaps: input.gaps ?? current.gaps,
    ambitions: input.ambitions ?? current.ambitions,
    orgAmbitions: {
      ...current.orgAmbitions,
      ...(input.orgAmbitions ?? {}),
    },
    updatedAt: new Date().toISOString(),
  };

  return structuredClone(rows[index]);
}

export function addFunctionTeleologyRow(
  engagementId: string,
  streamType: ValueStreamType,
  functionUnit: FunctionalUnit,
): TeleologyRow | undefined {
  ensureRowsForLoadedStreams(engagementId);

  const existing = rows.find(
    (row) =>
      row.engagementId === engagementId &&
      row.streamType === streamType &&
      row.functionUnit === functionUnit,
  );
  if (existing) {
    return structuredClone(existing);
  }

  const row = createFunctionRow(engagementId, streamType, functionUnit);
  rows.push(row);
  return structuredClone(row);
}

export function setTeleologyRowStatus(
  engagementId: string,
  rowId: string,
  approvalStatus: TeleologyRow["approvalStatus"],
): TeleologyRow | undefined {
  const index = rows.findIndex(
    (item) => item.engagementId === engagementId && item.id === rowId,
  );
  if (index === -1) {
    return undefined;
  }

  rows[index] = {
    ...rows[index],
    approvalStatus,
    updatedAt: new Date().toISOString(),
  };

  return structuredClone(rows[index]);
}

export function resetTeleologyStore(): void {
  rows = structuredClone(seedRows);
}
