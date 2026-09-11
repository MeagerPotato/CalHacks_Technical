import { AppLink } from "@/components/ui/AppLink";
import { Card } from "@/components/ui/Card";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { Timestamp } from "@/components/ui/Timestamp";
import { COPY } from "@/content/copy";
import type { PortalProgressView } from "@/lib/view-models/types";

const TITLE_ID = "progress-card-title";

export interface ProgressCardProps {
  view: PortalProgressView;
}

/** The draft's main card: percent complete, the next step, the last-saved time, and the call to action. */
export function ProgressCard({ view }: ProgressCardProps) {
  return (
    <Card labelledBy={TITLE_ID} data-testid="progress-card">
      <div className="flex flex-col gap-4">
        <h2 id={TITLE_ID} className="text-2xl font-bold">
          {COPY.portal.progressTitle}
        </h2>
        <ProgressMeter
          id="portal-progress"
          value={view.percent}
          label={COPY.portal.progressLabel}
          valueText={view.valueText}
        />
        {view.nextStep ? (
          <p>
            <span className="font-semibold">{`${COPY.portal.nextStep}:`}</span>{" "}
            <AppLink href={view.nextStep.href}>{view.nextStep.label}</AppLink>
          </p>
        ) : null}
        <p className="text-sm">
          <Timestamp value={view.lastSaved} prefix={COPY.portal.lastSaved} fallback={COPY.portal.notSaved} />
        </p>
        <div>
          <AppLink href={view.cta.href} variant="primary">
            {view.cta.label}
          </AppLink>
        </div>
      </div>
    </Card>
  );
}
