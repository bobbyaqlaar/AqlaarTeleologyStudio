"use client";

import { ORG_THEMES } from "@/lib/constants/org-themes";
import type { OrgAmbitions } from "@/lib/types";
import { StringListField } from "@/components/teleology/string-list-field";
import { cn } from "@/lib/utils";

interface OrgThemeSectionProps {
  orgAmbitions: OrgAmbitions;
  disabled?: boolean;
  onChange: (orgAmbitions: OrgAmbitions) => void;
}

export function OrgThemeSection({
  orgAmbitions,
  disabled = false,
  onChange,
}: OrgThemeSectionProps): React.ReactNode {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Organizational themes
        </p>
        <p className="text-xs text-muted-foreground">
          Link ambitions to revenue, cost, customer experience, and time-to-market.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ORG_THEMES.map((theme) => (
          <div
            key={theme.id}
            className={cn(
              "rounded-lg border border-border bg-card/50 p-3",
              theme.badgeClass.split(" ")[0],
            )}
          >
            <StringListField
              id={`org-${theme.id}`}
              label={theme.label}
              description={theme.description}
              items={orgAmbitions[theme.id]}
              disabled={disabled}
              placeholder={`${theme.shortLabel} ambition…`}
              onChange={(items) =>
                onChange({
                  ...orgAmbitions,
                  [theme.id]: items,
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgThemeSummary({
  orgAmbitions,
}: {
  orgAmbitions: OrgAmbitions;
}): React.ReactNode {
  const active = ORG_THEMES.filter(
    (theme) => orgAmbitions[theme.id].length > 0,
  );

  if (active.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No themes linked</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((theme) => (
        <span
          key={theme.id}
          className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
            theme.badgeClass,
          )}
        >
          {theme.shortLabel} · {orgAmbitions[theme.id].length}
        </span>
      ))}
    </div>
  );
}
