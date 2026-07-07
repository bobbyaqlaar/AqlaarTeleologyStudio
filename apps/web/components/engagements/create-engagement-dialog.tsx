"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { engagementService } from "@/lib/mock/services/engagement-service";
import type { Engagement } from "@/lib/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface CreateEngagementDialogProps {
  onCreated?: (engagement: Engagement) => void;
}

export function CreateEngagementDialog({
  onCreated,
}: CreateEngagementDialogProps): React.ReactNode {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim() || !client.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const engagement = await engagementService.create({
        name: name.trim(),
        client: client.trim(),
        description: description.trim() || undefined,
      });
      onCreated?.(engagement);
      setOpen(false);
      setName("");
      setClient("");
      setDescription("");
      router.push(`/engagements/${engagement.id}/streams`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants(), "gap-2")}>
        <Plus className="size-4" />
        New engagement
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create engagement</DialogTitle>
          <DialogDescription>
            Start a new client transformation workspace with five value stream
            baselines.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="engagement-name">Engagement name</Label>
            <Input
              id="engagement-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digital transformation — Phase 1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="engagement-client">Client</Label>
            <Input
              id="engagement-client"
              value={client}
              onChange={(event) => setClient(event.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="engagement-description">Description</Label>
            <Textarea
              id="engagement-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Scope and objectives for this engagement"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !name.trim() || !client.trim()}
          >
            Create and open streams
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
