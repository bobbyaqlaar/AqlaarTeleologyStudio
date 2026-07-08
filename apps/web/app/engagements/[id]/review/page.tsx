import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ReviewWorkspace } from "@/components/review/review-workspace";
import { engagementService } from "@/lib/mock/services/engagement-service";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({
  params,
}: ReviewPageProps): Promise<React.ReactNode> {
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
        { label: "Review" },
      ]}
      engagementId={engagement.id}
      currentStep="review"
      title="Review and approve"
    >
      <ReviewWorkspace engagementId={engagement.id} />
    </AppShell>
  );
}
