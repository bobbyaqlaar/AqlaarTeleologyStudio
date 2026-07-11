"use client";

import { Link2 } from "lucide-react";
import { VALUE_STREAM_META, VALUE_STREAM_ORDER } from "@/lib/constants/value-streams";
import type { Initiative } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InitiativeLinkageProps {
  initiative: Initiative | null;
}

/** Cross-stream linkage visual: streams as columns, the initiative as a band
 * connecting the exact steps and ontology classes it touches in each. */
export function InitiativeLinkage({
  initiative,
}: InitiativeLinkageProps): React.ReactNode {
  if (!initiative) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Select an initiative to see how it links the value streams together.
      </div>
    );
  }

  const orderedLinks = [...initiative.streamLinks].sort(
    (a, b) =>
      VALUE_STREAM_ORDER.indexOf(a.streamType) -
      VALUE_STREAM_ORDER.indexOf(b.streamType),
  );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="font-medium">{initiative.name}</p>
        <p className="text-xs text-muted-foreground">
          How this initiative connects {orderedLinks.length} value streams
        </p>
      </div>

      {/* The band: one connected strip across all touched streams. */}
      <div className="relative">
        <div
          className="absolute left-0 right-0 top-10 hidden h-0.5 bg-primary/40 lg:block"
          aria-hidden
        />
        <div
          className={cn(
            "grid gap-3",
            orderedLinks.length >= 3
              ? "lg:grid-cols-3"
              : orderedLinks.length === 2
                ? "lg:grid-cols-2"
                : "lg:grid-cols-1",
          )}
        >
          {orderedLinks.map((link) => {
            const meta = VALUE_STREAM_META[link.streamType];
            return (
              <div
                key={link.streamType}
                className="relative rounded-lg border border-primary/30 bg-primary/[0.03]"
              >
                <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                    {meta?.shortLabel ?? link.streamType}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {meta?.label ?? link.streamType}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {link.role}
                    </p>
                  </div>
                  <Link2 className="ml-auto size-3.5 shrink-0 text-primary/60" />
                </div>
                <div className="space-y-1.5 p-3">
                  {link.stepNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {link.stepNames.map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-border bg-card px-2 py-0.5 text-xs"
                        >
                          ⚙ {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {link.classLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {link.classLabels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          ◆ {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {link.stepNames.length === 0 &&
                  link.classLabels.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No specific artefacts named.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {initiative.consolidates.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Consolidates
          </p>
          <ul className="mt-1 space-y-1">
            {initiative.consolidates.map((item) => (
              <li
                key={item}
                className="rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-xs"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
