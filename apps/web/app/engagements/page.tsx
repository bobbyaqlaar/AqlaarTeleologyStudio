import { AppShell } from "@/components/shell/app-shell";
import { EngagementList } from "@/components/engagements/engagement-list";
import { FunctionUnitLegend } from "@/components/functions/function-unit-legend";

export default function EngagementsPage(): React.ReactNode {
  return (
    <AppShell
      breadcrumbs={[{ label: "Engagements" }]}
      title="Engagements"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Consultant workspace</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manage client transformation engagements, load generic value stream
            baselines, and prepare for BPMN and ontology workshops.
          </p>
        </section>
        <EngagementList />
        <FunctionUnitLegend />
      </div>
    </AppShell>
  );
}
