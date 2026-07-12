import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { AuditTrailWorkspace } from "@/components/audit/audit-trail-workspace";
import { engagementService } from "@/lib/mock/services/engagement-service";

interface AuditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditPage({
  params,
}: AuditPageProps): Promise<React.ReactNode> {
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
        { label: "Audit trail" },
      ]}
      engagementId={engagement.id}
      currentStep="review"
      title="Audit trail"
    >
      <AuditTrailWorkspace engagementId={engagement.id} />
    </AppShell>
  );
}
