import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
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
import type { ValueStreamType } from "@/lib/types";

interface StreamDetailPageProps {
  params: Promise<{ id: string; streamId: string }>;
}

const STREAM_IDS = new Set<string>(["o2c", "p2p", "c2m", "h2r", "t2r"]);

export default async function StreamDetailPage({
  params,
}: StreamDetailPageProps): Promise<React.ReactNode> {
  const { id, streamId } = await params;

  if (!STREAM_IDS.has(streamId)) {
    notFound();
  }

  const streamType = streamId as ValueStreamType;
  const engagement = getEngagementById(id);

  if (!engagement) {
    notFound();
  }

  const stream = engagement.valueStreams.find((item) => item.type === streamType);

  if (!stream) {
    notFound();
  }

  if (!stream.baselineLoaded) {
    notFound();
  }

  const meta = VALUE_STREAM_META[streamType];

  return (
    <AppShell
      breadcrumbs={[
        { label: "Engagements", href: "/engagements" },
        { label: engagement.client, href: `/engagements/${engagement.id}` },
        {
          label: "Value streams",
          href: `/engagements/${engagement.id}/streams`,
        },
        { label: meta.shortLabel },
      ]}
      engagementId={engagement.id}
      currentStep="streams"
      title={`${meta.shortLabel} · ${meta.label}`}
      actions={
        <Link
          href={`/engagements/${engagement.id}/streams/${streamType}/process`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Open process editor
        </Link>
      }
    >
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Baseline loaded</CardTitle>
          <CardDescription>
            Generic template ready. Customize the BPMN process map in the
            process editor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge>{meta.label}</Badge>
          <p className="text-sm text-muted-foreground">
            Step 2 — map tasks, assign function units, and collect stakeholder
            comments during workshops.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/engagements/${engagement.id}/streams/${streamType}/process`}
              className={buttonVariants()}
            >
              Edit process (BPMN)
            </Link>
            <Link
              href={`/engagements/${engagement.id}/streams/${streamType}/ontology`}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Edit ontology (OWL)
            </Link>
            <Link
              href={`/engagements/${engagement.id}/streams`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Back to all streams
            </Link>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
