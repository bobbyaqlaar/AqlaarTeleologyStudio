import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GitBranch } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { FunctionUnitLegend } from "@/components/functions/function-unit-legend";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEngagementById } from "@/lib/mock/store";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { cn } from "@/lib/utils";

interface EngagementDashboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function EngagementDashboardPage({
  params,
}: EngagementDashboardPageProps): Promise<React.ReactNode> {
  const { id } = await params;
  const engagement = getEngagementById(id);

  if (!engagement) {
    notFound();
  }

  const loadedCount = engagement.valueStreams.filter(
    (stream) => stream.baselineLoaded,
  ).length;

  return (
    <AppShell
      breadcrumbs={[
        { label: "Engagements", href: "/engagements" },
        { label: engagement.client },
      ]}
      engagementId={engagement.id}
      currentStep="streams"
      title={engagement.name}
      actions={
        <Link
          href={`/engagements/${engagement.id}/streams`}
          className={cn(buttonVariants({ size: "sm" }), "gap-2")}
        >
          Continue to streams
          <ArrowRight className="size-4" />
        </Link>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Client</CardDescription>
              <CardTitle className="text-lg">{engagement.client}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="capitalize">{engagement.status}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Baselines loaded</CardDescription>
              <CardTitle className="text-lg">
                {loadedCount} / {engagement.valueStreams.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Step 1 — load generic templates for each value stream.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Participants</CardDescription>
              <CardTitle className="text-lg">
                {engagement.participants.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Consultant-led edits with stakeholder review in later steps.
            </CardContent>
          </Card>
        </div>

        {engagement.description ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scope</CardTitle>
              <CardDescription>{engagement.description}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="size-4 text-primary" />
              Value streams
            </CardTitle>
            <CardDescription>
              Generic cross-industry baselines for all five enterprise value
              streams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {engagement.valueStreams.map((stream) => (
                <div
                  key={stream.id}
                  className="rounded-lg border border-border bg-muted/20 p-3"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {VALUE_STREAM_META[stream.type].shortLabel}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {VALUE_STREAM_META[stream.type].label}
                  </p>
                  <Badge
                    variant={stream.baselineLoaded ? "default" : "secondary"}
                    className="mt-2"
                  >
                    {stream.baselineLoaded ? "Loaded" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <FunctionUnitLegend compact />
      </div>
    </AppShell>
  );
}
