import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import type { BreadcrumbItem } from "@/components/shell/app-breadcrumbs";
import type { WorkflowStep } from "@/lib/types";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs: BreadcrumbItem[];
  engagementId?: string;
  currentStep?: WorkflowStep;
  title?: string;
  actions?: React.ReactNode;
}

export function AppShell({
  children,
  breadcrumbs,
  engagementId,
  currentStep,
  title,
  actions,
}: AppShellProps): React.ReactNode {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar engagementId={engagementId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          breadcrumbs={breadcrumbs}
          engagementId={engagementId}
          currentStep={currentStep}
          title={title}
          actions={actions}
        />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
