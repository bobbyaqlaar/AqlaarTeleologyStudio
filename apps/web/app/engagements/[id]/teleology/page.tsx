import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { TeleologyWorkspace } from "@/components/teleology/teleology-workspace";
import { buttonVariants } from "@/components/ui/button";
import { getEngagementById } from "@/lib/mock/store";
import { cn } from "@/lib/utils";

interface TeleologyPageProps {
  params: Promise<{ id: string }>;
}

export default async function TeleologyPage({
  params,
}: TeleologyPageProps): Promise<React.ReactNode> {
  const { id } = await params;
  const engagement = getEngagementById(id);

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
        { label: "Teleology" },
      ]}
      engagementId={engagement.id}
      currentStep="teleology"
      title="Teleology matrix"
      actions={
        loadedStreams.length > 0 ? (
          <Link
            href={`/engagements/${engagement.id}/streams/o2c/ontology`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View ontology
          </Link>
        ) : (
          <Link
            href={`/engagements/${engagement.id}/streams`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Load streams
          </Link>
        )
      }
    >
      <TeleologyWorkspace
        engagementId={engagement.id}
        loadedStreams={loadedStreams}
      />
    </AppShell>
  );
}
