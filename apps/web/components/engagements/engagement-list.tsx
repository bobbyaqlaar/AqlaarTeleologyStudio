"use client";

import { useEffect, useState } from "react";
import { EngagementCard } from "@/components/engagements/engagement-card";
import { CreateEngagementDialog } from "@/components/engagements/create-engagement-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { engagementService } from "@/lib/mock/services/engagement-service";
import type { Engagement } from "@/lib/types";

export function EngagementList(): React.ReactNode {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void engagementService.list().then((data) => {
      setEngagements(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            {engagements.length} engagement{engagements.length === 1 ? "" : "s"}
          </h2>
        </div>
        <CreateEngagementDialog
          onCreated={(engagement) =>
            setEngagements((current) => [engagement, ...current])
          }
        />
      </div>

      {engagements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm font-medium">No engagements yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first engagement to load value stream baselines.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {engagements.map((engagement) => (
            <EngagementCard key={engagement.id} engagement={engagement} />
          ))}
        </div>
      )}
    </div>
  );
}
