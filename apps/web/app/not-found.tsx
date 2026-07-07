import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound(): React.ReactNode {
  return (
    <AppShell breadcrumbs={[{ label: "Not found" }]} title="Page not found">
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          The engagement or resource you requested does not exist.
        </p>
        <Link href="/engagements" className={buttonVariants()}>
          Back to engagements
        </Link>
      </div>
    </AppShell>
  );
}
