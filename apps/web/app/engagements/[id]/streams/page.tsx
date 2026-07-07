import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { StreamGrid } from "@/components/streams/stream-grid";
import { FunctionUnitLegend } from "@/components/functions/function-unit-legend";
import { getEngagementById } from "@/lib/mock/store";

interface StreamsPageProps {
  params: Promise<{ id: string }>;
}

export default async function StreamsPage({
  params,
}: StreamsPageProps): Promise<React.ReactNode> {
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
        { label: engagement.client, href: `/engagements/${engagement.id}` },
        { label: "Value streams" },
      ]}
      engagementId={engagement.id}
      currentStep="streams"
      title="Load value stream baselines"
      actions={
        loadedCount > 0 ? (
          <Link
            href={`/engagements/${engagement.id}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {loadedCount}/5 loaded
          </Link>
        ) : undefined
      }
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Load generic baselines for each value stream. Each baseline includes
            BPMN process templates and OWL ontology seeds with function unit
            tags on every step.
          </p>
        </section>
        <StreamGrid engagement={engagement} />
        <FunctionUnitLegend compact />
      </div>
    </AppShell>
  );
}
