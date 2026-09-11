import { EngineerArt } from "@/components/art/EngineerArt";
import { DeadlineCard } from "@/components/portal/DeadlineCard";
import { LaunchReadiness } from "@/components/portal/LaunchReadiness";
import { PortalWelcome } from "@/components/portal/PortalWelcome";
import { ProgressCard } from "@/components/portal/ProgressCard";
import type { PortalDraftView } from "@/lib/view-models/types";

export interface PortalDraftDashboardProps {
  view: PortalDraftView;
}

/**
 * The portal dashboard for an editable draft. One column on small screens; from md, the progress card and Launch
 * Readiness take two columns beside the deadline card and the engineer art. DOM order matches the reading order.
 */
export function PortalDraftDashboard({ view }: PortalDraftDashboardProps) {
  return (
    <div className="flex flex-col gap-8">
      <PortalWelcome view={view.welcome} />
      <div className="grid gap-6 md:grid-cols-3 md:items-start">
        <div className="md:col-span-2">
          <ProgressCard view={view.progress} />
        </div>
        <DeadlineCard deadline={view.deadline} />
        <div className="md:col-span-2">
          <LaunchReadiness items={view.readiness} headingLevel={2} />
        </div>
        <EngineerArt variant="dashboard" />
      </div>
    </div>
  );
}
