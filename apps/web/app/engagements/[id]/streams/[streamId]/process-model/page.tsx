import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ProcessModelWorkspace } from "@/components/process-model/process-model-workspace";
import { engagementService } from "@/lib/mock/services/engagement-service";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { ValueStreamType } from "@/lib/types";

interface ProcessModelPageProps {
  params: Promise<{ id: string; streamId: string }>;
}

const STREAM_IDS = new Set<string>(["o2c", "p2p", "c2m", "h2r", "t2r"]);

export default async function ProcessModelPage({
  params,
}: ProcessModelPageProps): Promise<React.ReactNode> {
  const { id, streamId } = await params;
  if (!STREAM_IDS.has(streamId)) {
    notFound();
  }
  const streamType = streamId as ValueStreamType;
  const engagement = await engagementService.get(id);
  if (!engagement) {
    notFound();
  }
  const meta = VALUE_STREAM_META[streamType];

  return (
    <AppShell
      breadcrumbs={[
        { label: "Engagements", href: "/engagements" },
        { label: engagement.client, href: `/engagements/${id}` },
        { label: "Value streams", href: `/engagements/${id}/streams` },
        { label: meta.shortLabel, href: `/engagements/${id}/streams/${streamType}` },
        { label: "Process model" },
      ]}
      engagementId={engagement.id}
      currentStep="process"
      title={`Process model · ${meta.label}`}
    >
      <ProcessModelWorkspace
        engagementId={engagement.id}
        streamType={streamType}
        functionUnits={engagement.functionUnits}
      />
    </AppShell>
  );
}
