import Link from "next/link";
import { notFound } from "next/navigation";
import { AlignmentWorkspace } from "@/components/alignment/alignment-workspace";
import { AppShell } from "@/components/shell/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { engagementService } from "@/lib/mock/services/engagement-service";
import { cn } from "@/lib/utils";

interface AlignmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function AlignmentPage({
  params,
}: AlignmentPageProps): Promise<React.ReactNode> {
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
        { label: "Alignment" },
      ]}
      engagementId={engagement.id}
      title="Alignment — current vs teleology"
      actions={
        <Link
          href={`/engagements/${engagement.id}/initiatives`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          View initiatives
        </Link>
      }
    >
      <AlignmentWorkspace engagementId={engagement.id} />
    </AppShell>
  );
}
