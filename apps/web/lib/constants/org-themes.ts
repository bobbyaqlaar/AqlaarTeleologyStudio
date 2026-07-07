import type { OrgTheme } from "@/lib/types";

export interface OrgThemeMeta {
  id: OrgTheme;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
}

export const ORG_THEMES: OrgThemeMeta[] = [
  {
    id: "revenue",
    label: "Revenue",
    shortLabel: "Rev",
    description: "Top-line growth and monetization outcomes",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "cost",
    label: "Cost",
    shortLabel: "Cost",
    description: "Efficiency, margin, and operating expense",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  {
    id: "cx",
    label: "Customer experience",
    shortLabel: "CX",
    description: "Satisfaction, loyalty, and service quality",
    badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  {
    id: "ttm",
    label: "Time to market",
    shortLabel: "TTM",
    description: "Speed of delivery and change velocity",
    badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
];

export const ORG_THEME_MAP = Object.fromEntries(
  ORG_THEMES.map((theme) => [theme.id, theme]),
) as Record<OrgTheme, OrgThemeMeta>;
