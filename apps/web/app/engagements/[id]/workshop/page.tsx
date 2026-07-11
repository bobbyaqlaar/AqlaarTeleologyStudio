import { notFound } from "next/navigation";
import { WorkshopWorkspace } from "@/components/workshop/workshop-workspace";
import { engagementService } from "@/lib/mock/services/engagement-service";

interface WorkshopPageProps {
  params: Promise<{ id: string }>;
}

/** Full-screen presenter surface — no app shell; the consultant shares this
 * screen with stakeholders during the session. */
export default async function WorkshopPage({
  params,
}: WorkshopPageProps): Promise<React.ReactNode> {
  const { id } = await params;
  const engagement = await engagementService.get(id);

  if (!engagement) {
    notFound();
  }

  return <WorkshopWorkspace engagement={engagement} />;
}
