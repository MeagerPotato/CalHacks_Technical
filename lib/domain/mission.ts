import type { ApplicationStatus, DecisionStatus } from "@/lib/domain/enums";

// =============================================================================
// Mission tracker state, derived only from real workflow fields.
//
//   status       stage      launch     cruise     landing
//   draft        assembly   upcoming   upcoming   upcoming
//   submitted    cruise     complete   current    upcoming
//   in_review    cruise     complete   current    upcoming   (isUnderReview)
//   accepted     landing    complete   complete   complete   (decision)
//   waitlisted   landing    complete   complete   complete   (decision)
//
// No ETA, percentage, or reviewer identity is ever derived here.
// =============================================================================

export const MISSION_STAGES = ["assembly", "launch", "cruise", "landing"] as const;
export type MissionStage = (typeof MISSION_STAGES)[number];

export const MISSION_LEGS = ["launch", "cruise", "landing"] as const;
export type MissionLeg = (typeof MISSION_LEGS)[number];

export type MissionLegState = "complete" | "current" | "upcoming";

export interface MissionLegSnapshot {
  leg: MissionLeg;
  state: MissionLegState;
  /** Real timestamp for the leg when known (launched_at, review_started_at, decision_released_at). */
  occurredAt: string | null;
}

export interface MissionStatusFields {
  status: ApplicationStatus;
  launched_at: string | null;
  review_started_at: string | null;
  decision_released_at: string | null;
}

export interface MissionState {
  status: ApplicationStatus;
  stage: MissionStage;
  isSubmitted: boolean;
  /** True once an organizer has started reviewing (status in_review). */
  isUnderReview: boolean;
  /** Released outcome, or null before a decision. */
  decision: DecisionStatus | null;
  launchedAt: string | null;
  reviewStartedAt: string | null;
  decisionReleasedAt: string | null;
  legs: [MissionLegSnapshot, MissionLegSnapshot, MissionLegSnapshot];
}

export function deriveMissionState(fields: MissionStatusFields): MissionState {
  const { status } = fields;
  const decision: DecisionStatus | null = status === "accepted" || status === "waitlisted" ? status : null;
  const isSubmitted = status !== "draft";

  const stage: MissionStage = !isSubmitted ? "assembly" : decision ? "landing" : "cruise";

  const launch: MissionLegSnapshot = {
    leg: "launch",
    state: isSubmitted ? "complete" : "upcoming",
    occurredAt: fields.launched_at,
  };
  const cruise: MissionLegSnapshot = {
    leg: "cruise",
    state: !isSubmitted ? "upcoming" : decision ? "complete" : "current",
    occurredAt: fields.review_started_at,
  };
  const landing: MissionLegSnapshot = {
    leg: "landing",
    state: decision ? "complete" : "upcoming",
    occurredAt: fields.decision_released_at,
  };

  return {
    status,
    stage,
    isSubmitted,
    isUnderReview: status === "in_review",
    decision,
    launchedAt: fields.launched_at,
    reviewStartedAt: fields.review_started_at,
    decisionReleasedAt: fields.decision_released_at,
    legs: [launch, cruise, landing],
  };
}
