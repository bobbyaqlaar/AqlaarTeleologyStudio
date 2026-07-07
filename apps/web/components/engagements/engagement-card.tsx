"use client";

import Link from "next/link";
import { ArrowRight, Building2, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Engagement } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EngagementCardProps {
  engagement: Engagement;
}

const statusVariant: Record<
  Engagement["status"],
  "default" | "secondary" | "outline"
> = {
  active: "default",
  draft: "secondary",
  completed: "outline",
};

export function EngagementCard({
  engagement,
}: EngagementCardProps): React.ReactNode {
  const loadedStreams = engagement.valueStreams.filter(
    (stream) => stream.baselineLoaded,
  ).length;

  return (
    <Card className="transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{engagement.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              {engagement.client}
            </CardDescription>
          </div>
          <Badge variant={statusVariant[engagement.status]} className="capitalize">
            {engagement.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {engagement.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {engagement.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            Updated {new Date(engagement.updatedAt).toLocaleDateString()}
          </span>
          <span>
            {loadedStreams}/{engagement.valueStreams.length || 5} baselines loaded
          </span>
        </div>
        <Link
          href={`/engagements/${engagement.id}`}
          className={cn(buttonVariants({ size: "sm" }), "gap-2")}
        >
          Open engagement
          <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
