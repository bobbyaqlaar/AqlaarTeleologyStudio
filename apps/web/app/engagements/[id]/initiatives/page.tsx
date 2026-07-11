import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { InitiativesWorkspace } from "@/components/initiatives/initiatives-workspace";
import { engagementService } from "@/lib/mock/services/engagement-service";

interface InitiativesPageProps {
  params: Promise<{ id: string }>;
}

export default async function InitiativesPage({
  params,
}: InitiativesPageProps): Promise<React.ReactNode> {
  const { id } = await params;
  const engagement = await engagementService.get(id);

  if (!engagement) {
    notFound();
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "Engagements", href: "/engagements" },
        { label: engagement.client, href: `/engagements/${id}` },
        { label: "Initiatives" },
      ]}
      engagementId={engagement.id}
      title="AI initiative candidates"
    >
      <InitiativesWorkspace engagementId={engagement.id} />
    </AppShell>
  );
}
