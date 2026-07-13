"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRIES, industryLabel } from "@/lib/constants/industries";
import { ontologyService } from "@/lib/api/ontology-service";
import { engagementService } from "@/lib/mock/services/engagement-service";
import type { Engagement, Industry } from "@/lib/types";
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
  const [industry, setIndustry] = useState<Industry>("generic");
  const [industryOptions, setIndustryOptions] = useState<
    Array<{ id: Industry; label: string }>
  >(INDUSTRIES.map((item) => ({ id: item.id, label: item.label })));
  const [submitting, setSubmitting] = useState(false);

  // Discover available industry baselines from the API when the dialog opens;
  // fall back to the static list (UI-only mode) if the API is unreachable.
  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    void ontologyService
      .listBaselines()
      .then((catalog) => {
        const slugs = Object.keys(catalog.industries);
        if (active && slugs.length > 0) {
          setIndustryOptions(
            slugs.map((slug) => ({ id: slug, label: industryLabel(slug) })),
          );
        }
      })
      .catch(() => {
        // keep the static fallback options
      });
    return () => {
      active = false;
    };
  }, [open]);

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
        industry,
      });
      onCreated?.(engagement);
      setOpen(false);
      setName("");
      setClient("");
      setDescription("");
      setIndustry("generic");
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
            <Label htmlFor="engagement-industry">Industry baseline</Label>
            <Select
              value={industry}
              onValueChange={(value) => setIndustry(value as Industry)}
            >
              <SelectTrigger id="engagement-industry" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {industryOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Determines which process framework seeds the value stream
              baselines.
            </p>
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
