import type { Industry } from "@/lib/types";

export const INDUSTRIES: Array<{ id: Industry; label: string; description: string }> = [
  {
    id: "generic",
    label: "Cross-industry (APQC)",
    description: "APQC PCF v8 cross-industry baselines",
  },
  {
    id: "telecom",
    label: "Telecom (TM Forum eTOM)",
    description: "eTOM process baselines from TM Forum MODA",
  },
];

export const INDUSTRY_MAP = Object.fromEntries(
  INDUSTRIES.map((item) => [item.id, item]),
) as Record<Industry, (typeof INDUSTRIES)[number]>;
