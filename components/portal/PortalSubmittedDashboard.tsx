import { DeadlineCard } from "@/components/portal/DeadlineCard";
import { PortalWelcome } from "@/components/portal/PortalWelcome";
import { SubmittedStatusCard } from "@/components/portal/SubmittedStatusCard";
import type { PortalSubmittedView } from "@/lib/view-models/types";

export interface PortalSubmittedDashboardProps {
  view: PortalSubmittedView;
}

/** The portal dashboard once the application has launched: editing controls give way to the mission tracker link. */
export function PortalSubmittedDashboard({ view }: PortalSubmittedDashboardProps) {
  return (
    <div className="flex flex-col gap-8">
      <PortalWelcome view={view.welcome} />
      <div className="grid gap-6 md:grid-cols-3 md:items-start">
        <div className="md:col-span-2">
          <SubmittedStatusCard view={view} />
        </div>
        <DeadlineCard deadline={view.deadline} />
      </div>
    </div>
  );
}
