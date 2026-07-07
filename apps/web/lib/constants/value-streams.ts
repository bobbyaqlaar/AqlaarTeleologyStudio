import type { BaselineTemplate, ValueStreamType } from "@/lib/types";

export const VALUE_STREAM_META: Record<
  ValueStreamType,
  { label: string; shortLabel: string; description: string }
> = {
  o2c: {
    label: "Order to Cash",
    shortLabel: "O2C",
    description: "Quote-to-order, fulfillment, billing, and collections.",
  },
  p2p: {
    label: "Procure to Pay",
    shortLabel: "P2P",
    description: "Requisition, sourcing, purchase orders, and supplier payment.",
  },
  c2m: {
    label: "Concept to Market",
    shortLabel: "C2M",
    description: "Ideation, development, launch, and product lifecycle.",
  },
  h2r: {
    label: "Hire to Retire",
    shortLabel: "H2R",
    description: "Recruiting, onboarding, development, and offboarding.",
  },
  t2r: {
    label: "Trouble to Resolve",
    shortLabel: "T2R",
    description: "Incident intake, diagnosis, resolution, and closure.",
  },
};

export const VALUE_STREAM_ORDER: ValueStreamType[] = [
  "o2c",
  "p2p",
  "c2m",
  "h2r",
  "t2r",
];

export const BASELINE_TEMPLATES: BaselineTemplate[] = VALUE_STREAM_ORDER.map(
  (type) => ({
    id: `baseline-${type}`,
    streamType: type,
    name: VALUE_STREAM_META[type].label,
    description: VALUE_STREAM_META[type].description,
    processCount: 12 + VALUE_STREAM_ORDER.indexOf(type) * 3,
    ontologyClasses: 28 + VALUE_STREAM_ORDER.indexOf(type) * 5,
  }),
);
