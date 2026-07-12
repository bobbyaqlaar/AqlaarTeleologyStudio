"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { engagementService } from "@/lib/mock/services/engagement-service";
import { useRole } from "@/lib/context/role-context";
import type { Engagement } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EngagementCardProps {
  engagement: Engagement;
  onDeleted?: (engagementId: string) => void;
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
  onDeleted,
}: EngagementCardProps): React.ReactNode {
  const { canEdit } = useRole();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadedStreams = engagement.valueStreams.filter(
    (stream) => stream.baselineLoaded,
  ).length;

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    setError(null);
    try {
      await engagementService.delete(engagement.id);
      onDeleted?.(engagement.id);
      setConfirmOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete engagement.",
      );
    }
    setDeleting(false);
  };

  return (
    <>
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
              {loadedStreams}/{engagement.valueStreams.length || 5} baselines
              loaded
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/engagements/${engagement.id}`}
              className={cn(buttonVariants({ size: "sm" }), "gap-2")}
            >
              Open engagement
              <ArrowRight className="size-4" />
            </Link>
            {canEdit ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete engagement?</DialogTitle>
            <DialogDescription>
              Permanently remove <strong>{engagement.name}</strong> and all
              process, ontology, teleology, and connector data. Audit history is
              retained.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Deleting…" : "Delete engagement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
