"use client";

import type { ReviewSummary } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ReviewSummaryCardsProps {
  summary: ReviewSummary;
}

export function ReviewSummaryCards({
  summary,
}: ReviewSummaryCardsProps): React.ReactNode {
  const cards = [
    {
      label: "In review",
      value: summary.inReview,
      hint: "Awaiting stakeholder sign-off",
    },
    {
      label: "Open feedback",
      value: summary.openFeedback,
      hint: "BPMN comments to resolve",
    },
    {
      label: "Approved",
      value: summary.approved,
      hint: "Signed-off artefacts",
    },
    {
      label: "Rejected",
      value: summary.rejected,
      hint: "Needs consultant revision",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
