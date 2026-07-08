import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ConnectorsWorkspace } from "@/components/connectors/connectors-workspace";
import { engagementService } from "@/lib/mock/services/engagement-service";

interface ConnectorsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConnectorsPage({
  params,
}: ConnectorsPageProps): Promise<React.ReactNode> {
  const { id } = await params;
  const engagement = await engagementService.get(id);

  if (!engagement) {
    notFound();
  }

  const loadedStreams = engagement.valueStreams
    .filter((stream) => stream.baselineLoaded)
    .map((stream) => stream.type);

  return (
    <AppShell
      breadcrumbs={[
        { label: "Engagements", href: "/engagements" },
        { label: engagement.client, href: `/engagements/${id}` },
        { label: "Connectors" },
      ]}
      engagementId={engagement.id}
      currentStep="connectors"
      title="Enterprise connectors"
    >
      <ConnectorsWorkspace
        engagementId={engagement.id}
        loadedStreams={loadedStreams}
      />
    </AppShell>
  );
}
