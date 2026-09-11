import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-config";
import type { ApplicantApplication } from "@/lib/data/types";
import type { ApplicationStatus } from "@/lib/domain/enums";
import { deriveMissionState, type MissionLegSnapshot, type MissionState } from "@/lib/domain/mission";
import { toTimestampView } from "@/lib/format/datetime";
import type { DecisionView, MissionLegView, MissionView } from "@/lib/view-models/types";

// =============================================================================
// Rocket Mission Tracker view model.
//
// Only server code may call this (the mission page): it formats timestamps in the event time zone, and formatting in
// the browser could produce a different label and a hydration mismatch. Stage and leg states come from
// deriveMissionState, so the tracker shows only real status and workflow timestamps: never a percentage, an estimated
// time, or a reviewer.
// =============================================================================

type LegDetail = Pick<MissionLegView, "detail" | "time" | "timePrefix">;

// A prefix without a time would label nothing, so the prefix appears only alongside a real timestamp.
function timedDetail(detail: string, occurredAt: string | null, timePrefix: string): LegDetail {
  const time = toTimestampView(occurredAt);
  return { detail, time, timePrefix: time === null ? null : timePrefix };
}

function legDetail(snapshot: MissionLegSnapshot, mission: MissionState): LegDetail {
  switch (snapshot.leg) {
    case "launch":
      return timedDetail(APPLICATION_STATUS_LABELS.submitted, snapshot.occurredAt, COPY.mission.launched);
    case "cruise":
      return timedDetail(APPLICATION_STATUS_LABELS.in_review, snapshot.occurredAt, COPY.mission.reviewStarted);
    case "landing":
      return mission.decision === null
        ? { detail: COPY.mission.decisionPending, time: null, timePrefix: null }
        : timedDetail(APPLICATION_STATUS_LABELS[mission.decision], snapshot.occurredAt, COPY.mission.released);
  }
}

function toLegView(snapshot: MissionLegSnapshot, mission: MissionState): MissionLegView {
  return {
    leg: snapshot.leg,
    name: LOCKED.mission.legs[snapshot.leg],
    state: snapshot.state,
    stateLabel: COPY.mission.legStates[snapshot.state],
    ...legDetail(snapshot, mission),
  };
}

function toDecisionView(mission: MissionState): DecisionView | null {
  if (mission.decision === null) {
    return null;
  }
  return {
    status: mission.decision,
    label: APPLICATION_STATUS_LABELS[mission.decision],
    message: COPY.mission.decision[mission.decision],
    releasedAt: toTimestampView(mission.decisionReleasedAt),
  };
}

function reviewNoteFor(status: ApplicationStatus): string | null {
  switch (status) {
    case "submitted":
      return COPY.mission.received;
    case "in_review":
      return COPY.mission.reviewNote;
    default:
      return null;
  }
}

/**
 * The Rocket Mission Tracker for a launched application.
 *
 * - Legs: Launch shows the submitted status label with the launch time; Cruise shows the in-review status label with
 *   the review start time once review has started; Landing shows the decision label with the release time, or the
 *   pending-decision note before a decision.
 * - The headline is the landed headline at the landing stage and the cruising headline otherwise.
 * - The review note acknowledges receipt while submitted and reports the review while in review.
 * - `decision` is set only for a released Accepted or Waitlisted outcome.
 *
 * A draft has not launched, and the mission page redirects drafts to the portal before calling this. Because
 * deriveMissionState defines a draft mapping, a draft still produces a view rather than throwing: the assembly stage,
 * every leg upcoming, no timestamps, no review note, and no decision.
 */
export function toMissionView(application: ApplicantApplication): MissionView {
  // Derived from the application's own status and timestamps, so the stage, legs, and status label always agree.
  const mission = deriveMissionState({
    status: application.status,
    launched_at: application.launchedAt,
    review_started_at: application.reviewStartedAt,
    decision_released_at: application.decisionReleasedAt,
  });
  const [launch, cruise, landing] = mission.legs;

  return {
    stage: mission.stage,
    status: mission.status,
    statusLabel: APPLICATION_STATUS_LABELS[mission.status],
    headline: mission.stage === "landing" ? LOCKED.mission.landed : LOCKED.mission.cruising,
    legs: [toLegView(launch, mission), toLegView(cruise, mission), toLegView(landing, mission)],
    decision: toDecisionView(mission),
    reviewNote: reviewNoteFor(mission.status),
  };
}
