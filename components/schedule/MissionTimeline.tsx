import { Check, Circle, CircleDot, type LucideIcon } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Timestamp } from "@/components/ui/Timestamp";
import type { TimelineStopState, TimelineView } from "@/lib/view-models/types";

const STATE_ICONS = {
  complete: Check,
  active: CircleDot,
  upcoming: Circle,
} as const satisfies Record<TimelineStopState, LucideIcon>;

const STATE_TONES = {
  complete: "success",
  active: "highlight",
  upcoming: "neutral",
} as const satisfies Record<TimelineStopState, BadgeTone>;

// The current stop gets a sky fill beside its state text; upcoming stops are muted with a dashed edge.
const STOP_CLASSES =
  "flex flex-col gap-3 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card " +
  "data-[current=true]:bg-accent data-[state=upcoming]:border-dashed data-[state=upcoming]:shadow-none";

export interface MissionTimelineProps {
  view: TimelineView;
  /** Id of the heading that labels the timeline. Pass a unique one when a page shows more than one timeline. */
  headingId?: string;
}

/**
 * The event schedule on the landing page, in order: applications open, the application deadline, results, and the
 * event. Each stop shows its date and its state as text. The current stop (in progress, or up next) also has
 * `aria-current="step"`, so it is never marked by color alone.
 */
export function MissionTimeline({ view, headingId = "mission-timeline-title" }: MissionTimelineProps) {
  return (
    <section data-testid="mission-timeline" aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-2xl font-bold">
        {view.title}
      </h2>
      {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
      <ol role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {view.stops.map((stop) => (
          <li
            key={stop.id}
            data-testid={`timeline-stop-${stop.id}`}
            data-state={stop.state}
            data-current={stop.isCurrent ? "true" : "false"}
            aria-current={stop.isCurrent ? "step" : undefined}
            className={STOP_CLASSES}
          >
            <h3 className="text-xl font-bold">{stop.name}</h3>
            {stop.when || stop.whenText ? (
              <p className="font-semibold">
                <Timestamp value={stop.when} fallback={stop.whenText ?? ""} />
              </p>
            ) : null}
            <div>
              <Badge tone={STATE_TONES[stop.state]} icon={STATE_ICONS[stop.state]}>
                {stop.stateLabel}
              </Badge>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
