import { functionUnitsFor } from "@/lib/constants/function-units";
import type { FunctionalUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FunctionUnitLegendProps {
  compact?: boolean;
  className?: string;
  // When given, show only this engagement's function units; else the full library.
  units?: FunctionalUnit[];
}

export function FunctionUnitLegend({
  compact = false,
  className,
  units,
}: FunctionUnitLegendProps): React.ReactNode {
  const shown = functionUnitsFor(units);
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3",
        className,
      )}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Function units
      </p>
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
        )}
      >
        {shown.map((unit) => (
          <div key={unit.id} className="flex items-center gap-2 text-xs">
            <span
              className={cn("size-2.5 shrink-0 rounded-full", unit.dotClass)}
              aria-hidden
            />
            <span className="truncate">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
