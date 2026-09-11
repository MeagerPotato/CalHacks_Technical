import { Rocket } from "lucide-react";

import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Timestamp } from "@/components/ui/Timestamp";
import { COPY, LOCKED } from "@/content/copy";
import type { PortalSubmittedView } from "@/lib/view-models/types";

const TITLE_ID = "submitted-card-title";

export interface SubmittedStatusCardProps {
  view: PortalSubmittedView;
}

/** The launched application's status, launch time, and the links to the mission tracker and the application. */
export function SubmittedStatusCard({ view }: SubmittedStatusCardProps) {
  return (
    <Card labelledBy={TITLE_ID} data-testid="submitted-card">
      <div className="flex flex-col gap-4">
        <h2 id={TITLE_ID} className="text-2xl font-bold">
          {COPY.portal.statusTitle}
        </h2>
        <div>
          <StatusBadge status={view.status} label={view.statusLabel} />
        </div>
        {/* A launched application always has launched_at; without one there is no time to show. */}
        {view.launched ? (
          <p className="text-sm">
            <Timestamp value={view.launched} prefix={COPY.portal.launched} fallback="" />
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <AppLink href={view.trackHref} variant="primary">
            <Rocket aria-hidden="true" className="size-5 shrink-0" />
            {LOCKED.portal.trackMission}
          </AppLink>
          <AppLink href={view.viewHref} variant="secondary">
            {COPY.portal.viewApplication}
          </AppLink>
        </div>
      </div>
    </Card>
  );
}
