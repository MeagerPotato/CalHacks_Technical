import { Check, Circle, CircleDot, Rocket, Satellite, type LucideIcon } from "lucide-react";

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
  "group relative z-10 flex min-h-48 flex-col gap-3 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card " +
  "data-[current=true]:bg-accent data-[current=true]:shadow-[0_5px_0_rgb(20_35_59/0.22)] " +
  "data-[state=complete]:border-t-success data-[state=complete]:border-t-[6px] " +
  "data-[state=upcoming]:border-dashed data-[state=upcoming]:bg-page data-[state=upcoming]:shadow-none";

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
    <section
      data-testid="mission-timeline"
      aria-labelledby={headingId}
      className="workshop-card relative flex flex-col gap-5 overflow-hidden rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-11 shrink-0 -rotate-6 items-center justify-center rounded-full border-2 border-border bg-highlight">
          <Satellite className="size-6" />
        </span>
        <h2 id={headingId} className="text-2xl font-bold sm:text-3xl">
          {view.title}
        </h2>
      </div>
      {/* The dashed route runs down through the markers while the stops stack, and across them from lg up. Markers are
          placed from each card's padding box, so complete stops, with their 6px top border, move up 4px to stay on it. */}
      <div className="relative">
        <span aria-hidden="true" className="absolute top-10 bottom-10 left-4 border-l-2 border-dashed border-border lg:top-[18px] lg:right-[12.5%] lg:bottom-auto lg:left-[12.5%] lg:border-t-2 lg:border-l-0" />
        {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
        <ol role="list" className="relative grid gap-4 pl-11 lg:grid-cols-4 lg:pt-16 lg:pl-0">
          {view.stops.map((stop) => (
            <li
              key={stop.id}
              data-testid={`timeline-stop-${stop.id}`}
              data-state={stop.state}
              data-current={stop.isCurrent ? "true" : "false"}
              aria-current={stop.isCurrent ? "step" : undefined}
              className={STOP_CLASSES}
            >
              <span aria-hidden="true" className="absolute top-5 -left-[47px] inline-flex size-9 items-center justify-center rounded-full border-2 border-border bg-page group-data-[current=true]:bg-accent lg:-top-16 lg:left-1/2 lg:-translate-x-1/2 group-data-[state=complete]:lg:-top-[68px]">
                {stop.isCurrent ? <Rocket className="size-5 -rotate-45" /> : <span className="size-2.5 rounded-full bg-ink" />}
              </span>
              <h3 className="text-xl font-bold">{stop.name}</h3>
              {stop.when || stop.whenText ? (
                <p className="font-semibold">
                  <Timestamp value={stop.when} fallback={stop.whenText ?? ""} />
                </p>
              ) : null}
              {/* An upcoming stop that is not the current one shows no badge. The current stop always keeps its state
                  as text, so it is never marked by color alone. */}
              {stop.isCurrent || stop.state !== "upcoming" ? (
                <div>
                  <Badge tone={STATE_TONES[stop.state]} icon={STATE_ICONS[stop.state]}>
                    {stop.stateLabel}
                  </Badge>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
