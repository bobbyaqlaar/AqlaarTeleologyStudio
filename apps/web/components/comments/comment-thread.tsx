"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { commentService } from "@/lib/mock/services/process-service";
import type { FunctionalUnit, ProcessComment, ValueStreamType } from "@/lib/types";
import { useRole } from "@/lib/context/role-context";
import { cn } from "@/lib/utils";

interface CommentThreadProps {
  engagementId: string;
  streamType: ValueStreamType;
  targetId: string | null;
  targetLabel: string | null;
  targetFunctionUnit?: FunctionalUnit;
}

export function CommentThread({
  engagementId,
  streamType,
  targetId,
  targetLabel,
  targetFunctionUnit,
}: CommentThreadProps): React.ReactNode {
  const { role, functionUnits, canApprove } = useRole();
  const [comments, setComments] = useState<ProcessComment[]>([]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!targetId) {
      setComments([]);
      return;
    }

    void commentService
      .list(engagementId, streamType, targetId)
      .then(setComments);
  }, [engagementId, streamType, targetId]);

  const canCommentOnTarget =
    canApprove &&
    (!targetFunctionUnit || functionUnits.includes(targetFunctionUnit));

  const handleSubmit = async (): Promise<void> => {
    if (!targetId || !targetLabel || !body.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const comment = await commentService.add({
        engagementId,
        streamType,
        authorId: role === "stakeholder" ? "user-stakeholder-1" : "user-consultant-1",
        authorName: role === "stakeholder" ? "Jordan Lee" : "Alex Morgan",
        role,
        targetType: "bpmn_element",
        targetId,
        targetLabel,
        functionUnit: targetFunctionUnit,
        body: body.trim(),
        resolved: false,
      });
      setComments((current) => [...current, comment]);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="size-4 text-primary" />
          <p className="text-sm font-medium">Comments</p>
        </div>
        {targetLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">On: {targetLabel}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Select a step to view thread.
          </p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-md border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{comment.authorName}</p>
                <span className="text-[10px] uppercase text-muted-foreground">
                  {comment.role}
                </span>
              </div>
              <p className="mt-2 text-sm">{comment.body}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {new Date(comment.createdAt).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </div>

      {canCommentOnTarget && targetId ? (
        <div className="border-t border-border p-4 space-y-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add stakeholder feedback on this step..."
            rows={3}
          />
          <Button
            size="sm"
            className="gap-2"
            disabled={submitting || !body.trim()}
            onClick={() => void handleSubmit()}
          >
            <Send className="size-4" />
            Post comment
          </Button>
        </div>
      ) : role === "stakeholder" && targetId && !canCommentOnTarget ? (
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          Your role is scoped to other function units.
        </div>
      ) : null}

      {role === "consultant" ? (
        <div
          className={cn(
            "border-t border-border px-4 py-2 text-xs text-muted-foreground",
            !targetId && "hidden",
          )}
        >
          Stakeholders comment here. You edit the canvas.
        </div>
      ) : null}
    </div>
  );
}
