import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { OntologyWorkspace } from "@/components/ontology/ontology-workspace";
import { engagementService } from "@/lib/mock/services/engagement-service";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { ValueStreamType } from "@/lib/types";

interface OntologyPageProps {
  params: Promise<{ id: string; streamId: string }>;
}

const STREAM_IDS = new Set<string>(["o2c", "p2p", "c2m", "h2r", "t2r"]);

export default async function OntologyPage({
  params,
}: OntologyPageProps): Promise<React.ReactNode> {
  const { id, streamId } = await params;

  if (!STREAM_IDS.has(streamId)) {
    notFound();
  }

  const streamType = streamId as ValueStreamType;
  const engagement = await engagementService.get(id);

  if (!engagement) {
    notFound();
  }

  const stream = engagement.valueStreams.find((item) => item.type === streamType);

  if (!stream) {
    notFound();
  }

  // Baseline-loaded state lives in the client-side mock store, so the server
  // render can't gate on it reliably; the workspace initializes the graph.
  const loadedStreams = engagement.valueStreams
    .filter((item) => item.baselineLoaded || item.type === streamType)
    .map((item) => item.type);

  const meta = VALUE_STREAM_META[streamType];

  return (
    <AppShell
      breadcrumbs={[
        { label: "Engagements", href: "/engagements" },
        { label: engagement.client, href: `/engagements/${id}` },
        { label: "Value streams", href: `/engagements/${id}/streams` },
        {
          label: meta.shortLabel,
          href: `/engagements/${id}/streams/${streamType}/process`,
        },
        { label: "Ontology" },
      ]}
      engagementId={engagement.id}
      currentStep="ontology"
      title={`Ontology · ${meta.label}`}
    >
      <OntologyWorkspace
        engagementId={engagement.id}
        streamType={streamType}
        loadedStreams={loadedStreams}
        industry={engagement.industry}
      />
    </AppShell>
  );
}
