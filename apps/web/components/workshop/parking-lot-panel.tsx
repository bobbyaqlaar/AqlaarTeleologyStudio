"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import type { ProcessComment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ParkingLotPanelProps {
  notes: ProcessComment[];
  busy: boolean;
  onAdd: (body: string) => void;
}

/** Session parking lot: open questions and decisions captured during the
 * workshop, persisted as comments so they land in the review queue. */
export function ParkingLotPanel({
  notes,
  busy,
  onAdd,
}: ParkingLotPanelProps): React.ReactNode {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-4 text-primary" />
        <p className="text-sm font-medium">Parking lot</p>
        <span className="text-xs text-muted-foreground">
          {notes.length} note{notes.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Park open questions and decisions here — they persist as workshop
            comments.
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-sm"
            >
              <p>{note.body}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {note.authorName} ·{" "}
                {new Date(note.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Open question, decision, follow-up…"
          className="min-h-16 text-sm"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={busy || draft.trim().length === 0}
          onClick={() => {
            onAdd(draft.trim());
            setDraft("");
          }}
        >
          Park it
        </Button>
      </div>
    </div>
  );
}
