import { ArrowLeft, Check, Circle, CircleDot, type LucideIcon } from "lucide-react";

import { LandingMoment } from "@/components/art/LandingMoment";
import { RocketArt, type RocketArtProps } from "@/components/art/RocketArt";
import { DecisionCard } from "@/components/mission/DecisionCard";
import { AppLink } from "@/components/ui/AppLink";
import { Badge, StatusBadge, type BadgeTone } from "@/components/ui/Badge";
import { Timestamp } from "@/components/ui/Timestamp";
import type { MissionLegState, MissionStage } from "@/lib/domain/mission";
import type { MissionView } from "@/lib/view-models/types";

// A draft (assembly) has not launched; the tracker never shows one, but the scene still has a defined frame.
const ROCKET_STAGES = {
  assembly: "launch",
  launch: "launch",
  cruise: "cruise",
  landing: "landing",
} as const satisfies Record<MissionStage, RocketArtProps["stage"]>;

const LEG_ICONS = {
  complete: Check,
  current: CircleDot,
  upcoming: Circle,
} as const satisfies Record<MissionLegState, LucideIcon>;

const LEG_TONES = {
  complete: "success",
  current: "highlight",
  upcoming: "neutral",
} as const satisfies Record<MissionLegState, BadgeTone>;

// Completed legs stay solid, the current leg gets a sky fill, and upcoming legs are muted with a dashed edge.
const LEG_CLASSES =
  "flex flex-col gap-3 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card " +
  "data-[state=current]:bg-accent data-[state=upcoming]:border-dashed data-[state=upcoming]:bg-page " +
  "data-[state=upcoming]:shadow-none";

export interface MissionTrackerProps {
  view: MissionView;
  backHref: string;
  backLabel: string;
  /** Accessible name of the ordered list of legs. */
  progressLabel: string;
  /** Text before the decision release time. */
  releasedPrefix: string;
}

/**
 * The Rocket Mission Tracker. The headline is the page `h1`; the legs are an ordered list with their state, detail,
 * and real timestamps as text, so the page is complete with motion off. It never shows a percentage, a progress
 * bar, or an estimated time.
 */
export function MissionTracker({ view, backHref, backLabel, progressLabel, releasedPrefix }: MissionTrackerProps) {
  return (
    <div data-testid="mission-tracker" data-stage={view.stage} className="flex flex-col gap-8">
      <div>
        <AppLink href={backHref} variant="quiet">
          <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
          {backLabel}
        </AppLink>
      </div>

      <div className="grid items-center gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold sm:text-4xl">{view.headline}</h1>
          <div>
            <StatusBadge status={view.status} label={view.statusLabel} />
          </div>
          {view.reviewNote ? <p className="text-lg">{view.reviewNote}</p> : null}
        </div>
        <div className="mx-auto w-full max-w-sm">
          <RocketArt stage={ROCKET_STAGES[view.stage]} />
        </div>
      </div>

      {/* The decision sits beside its landing moment near the top, so the reveal plays where the applicant looks. */}
      {view.decision ? (
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="mx-auto w-full max-w-sm">
            <LandingMoment decision={view.decision.status} />
          </div>
          <DecisionCard decision={view.decision} releasedPrefix={releasedPrefix} />
        </div>
      ) : null}

      {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
      <ol role="list" aria-label={progressLabel} className="grid gap-4 md:grid-cols-3">
        {view.legs.map((leg) => (
          <li
            key={leg.leg}
            data-testid={`mission-leg-${leg.leg}`}
            data-state={leg.state}
            aria-current={leg.state === "current" ? "step" : undefined}
            className={LEG_CLASSES}
          >
            <h2 className="text-xl font-bold">{leg.name}</h2>
            <div>
              <Badge tone={LEG_TONES[leg.state]} icon={LEG_ICONS[leg.state]}>
                {leg.stateLabel}
              </Badge>
            </div>
            {leg.detail ? <p>{leg.detail}</p> : null}
            {leg.time ? (
              <p className="text-sm">
                <Timestamp value={leg.time} prefix={leg.timePrefix ?? undefined} fallback="" />
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
