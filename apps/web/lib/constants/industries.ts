import type { Industry } from "@/lib/types";

/**
 * Friendly labels + descriptions for known industry baselines. The authoritative
 * list of *available* industries is discovered at runtime from
 * GET /api/v1/ontology/baselines (see ontologyService.listBaselines). This map
 * supplies presentation only; unknown slugs fall back to industryLabel().
 */
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
  {
    id: "retail",
    label: "Retail (APQC)",
    description: "APQC Retail PCF baselines",
  },
  {
    id: "utilities",
    label: "Utilities (APQC)",
    description: "APQC Utilities PCF baselines",
  },
];

export const INDUSTRY_MAP = Object.fromEntries(
  INDUSTRIES.map((item) => [item.id, item]),
) as Record<Industry, (typeof INDUSTRIES)[number]>;

/** Human label for an industry slug — known label, else title-cased slug. */
export function industryLabel(id: Industry): string {
  const known = INDUSTRY_MAP[id];
  if (known) {
    return known.label;
  }
  return id
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
