"use client";

import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { streamService } from "@/lib/mock/services/stream-service";
import { agentTriggerService } from "@/lib/api/agent-trigger-service";
import { useRole } from "@/lib/context/role-context";
import {
  BASELINE_TEMPLATES,
  VALUE_STREAM_META,
} from "@/lib/constants/value-streams";
import type { Engagement, ValueStreamType } from "@/lib/types";
import { useRouter } from "next/navigation";

interface StreamGridProps {
  engagement: Engagement;
}

export function StreamGrid({ engagement }: StreamGridProps): React.ReactNode {
  const router = useRouter();
  const { canEdit } = useRole();
  const [streams, setStreams] = useState(engagement.valueStreams);
  const [loadingType, setLoadingType] = useState<ValueStreamType | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const handleLoadBaseline = async (streamType: ValueStreamType): Promise<void> => {
    setLoadingType(streamType);
    setTriggerMessage(null);
    try {
      const updated = await streamService.loadBaseline(engagement.id, streamType);
      if (updated) {
        setStreams(updated.valueStreams);
        if (canEdit) {
          const trigger = await agentTriggerService.onBaselineLoaded(
            engagement.id,
            streamType,
          );
          if (trigger) {
            setTriggerMessage(trigger.message);
          }
        }
      }
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="space-y-4">
      {triggerMessage ? (
        <p className="text-sm text-muted-foreground">{triggerMessage}</p>
      ) : null}
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {streams.map((stream) => {
        const meta = VALUE_STREAM_META[stream.type];
        const baseline = BASELINE_TEMPLATES.find(
          (item) => item.streamType === stream.type,
        );
        const isLoading = loadingType === stream.type;

        return (
          <Card key={stream.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {meta.shortLabel} · {meta.label}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {meta.description}
                  </CardDescription>
                </div>
                <Badge
                  variant={stream.baselineLoaded ? "default" : "secondary"}
                >
                  {stream.baselineLoaded ? "Loaded" : "Not loaded"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {baseline ? (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
                  <div>
                    <p className="text-muted-foreground">Processes</p>
                    <p className="text-foreground">{baseline.processCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">OWL classes</p>
                    <p className="text-foreground">{baseline.ontologyClasses}</p>
                  </div>
                </div>
              ) : null}
              <p className="capitalize">Status: {stream.approvalStatus.replace("_", " ")}</p>
            </CardContent>
            <CardFooter className="mt-auto flex-col gap-2 sm:flex-row">
              {stream.baselineLoaded ? (
                <>
                  <Button
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() =>
                      router.push(
                        `/engagements/${engagement.id}/streams/${stream.type}/process`,
                      )
                    }
                  >
                    Edit process
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      router.push(
                        `/engagements/${engagement.id}/streams/${stream.type}`,
                      )
                    }
                  >
                    View stream
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  disabled={isLoading}
                  onClick={() => void handleLoadBaseline(stream.type)}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Database className="size-4" />
                  )}
                  Load baseline
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
    </div>
  );
}
