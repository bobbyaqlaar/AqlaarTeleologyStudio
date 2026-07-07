import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ProcessWorkspace } from "@/components/process/process-workspace";
import { getEngagementById } from "@/lib/mock/store";
import { ensureProcessState } from "@/lib/mock/process-store";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { ValueStreamType } from "@/lib/types";

interface ProcessPageProps {
  params: Promise<{ id: string; streamId: string }>;
}

const STREAM_IDS = new Set<string>(["o2c", "p2p", "c2m", "h2r", "t2r"]);

export default async function ProcessPage({
  params,
}: ProcessPageProps): Promise<React.ReactNode> {
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

  if (!stream?.baselineLoaded) {
    notFound();
  }

  ensureProcessState(id, streamType);

  const loadedStreams = engagement.valueStreams
    .filter((item) => item.baselineLoaded)
    .map((item) => item.type);

  const meta = VALUE_STREAM_META[streamType];

  return (
    <AppShell
      breadcrumbs={[
        { label: "Engagements", href: "/engagements" },
        { label: engagement.client, href: `/engagements/${id}` },
        { label: "Value streams", href: `/engagements/${id}/streams` },
        { label: meta.shortLabel, href: `/engagements/${id}/streams/${streamType}` },
        { label: "Process" },
      ]}
      engagementId={engagement.id}
      currentStep="process"
      title={`Process map · ${meta.label}`}
    >
      <ProcessWorkspace
        engagementId={engagement.id}
        streamType={streamType}
        loadedStreams={loadedStreams}
      />
    </AppShell>
  );
}
