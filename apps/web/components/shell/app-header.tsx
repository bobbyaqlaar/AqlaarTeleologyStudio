import { EngagementStepper } from "@/components/shell/engagement-stepper";
import { RoleSwitcher } from "@/components/shell/role-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { AppBreadcrumbs, type BreadcrumbItem } from "@/components/shell/app-breadcrumbs";
import type { WorkflowStep } from "@/lib/types";

interface AppHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  engagementId?: string;
  currentStep?: WorkflowStep;
  title?: string;
  actions?: React.ReactNode;
}

export function AppHeader({
  breadcrumbs,
  engagementId,
  currentStep,
  title,
  actions,
}: AppHeaderProps): React.ReactNode {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col gap-3 px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <AppBreadcrumbs items={breadcrumbs} />
            {title ? (
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {title}
              </h1>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <RoleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        {engagementId && currentStep ? (
          <EngagementStepper
            engagementId={engagementId}
            currentStep={currentStep}
          />
        ) : null}
      </div>
    </header>
  );
}
