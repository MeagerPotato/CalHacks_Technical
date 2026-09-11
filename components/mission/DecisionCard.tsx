import { StatusBadge } from "@/components/ui/Badge";
import { Timestamp } from "@/components/ui/Timestamp";
import type { DecisionView } from "@/lib/view-models/types";

const TITLE_ID = "decision-card-title";

export interface DecisionCardProps {
  decision: DecisionView;
  /** Text before the release time, for example "Released". */
  releasedPrefix: string;
}

/**
 * The released Accepted or Waitlisted decision. It is in the DOM from the first render, so assistive technology never
 * waits for motion; `data-reveal="after-landing"` lets app/globals.css fade it in after the landing moment, and only
 * when motion is allowed.
 */
export function DecisionCard({ decision, releasedPrefix }: DecisionCardProps) {
  return (
    <section
      data-testid="decision-card"
      data-status={decision.status}
      data-reveal="after-landing"
      aria-labelledby={TITLE_ID}
      className="flex flex-col gap-4 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card"
    >
      <h2 id={TITLE_ID} className="text-2xl font-bold">
        {decision.label}
      </h2>
      <div>
        <StatusBadge status={decision.status} label={decision.label} />
      </div>
      <p className="text-lg">{decision.message}</p>
      {/* A released decision always has decision_released_at; without one there is no time to show. */}
      {decision.releasedAt ? (
        <p className="text-sm">
          <Timestamp value={decision.releasedAt} prefix={releasedPrefix} fallback="" />
        </p>
      ) : null}
    </section>
  );
}
