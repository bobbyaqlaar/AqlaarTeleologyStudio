import { FUNCTION_UNITS } from "@/lib/constants/function-units";
import { cn } from "@/lib/utils";

interface FunctionUnitLegendProps {
  compact?: boolean;
  className?: string;
}

export function FunctionUnitLegend({
  compact = false,
  className,
}: FunctionUnitLegendProps): React.ReactNode {
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
        {FUNCTION_UNITS.map((unit) => (
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
